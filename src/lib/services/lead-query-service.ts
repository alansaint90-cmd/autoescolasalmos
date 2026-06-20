import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export type LeadQueryParams = {
  search?: string | null;
  origin?: string | null;
  stage?: string | null;
  temperature?: string | null;
  sentiment?: string | null;
  seller?: string | null;
  quick?: string | null;
  start?: Date | null;
  end?: Date | null;
  limit?: number;
};

type LeadRow = {
  id: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  origin: string;
  interest: string | null;
  temperature: string;
  sentiment: string;
  commercial_status: string;
  pipeline_stage: string;
  last_message_preview: string | null;
  last_interaction_at: Date | string | null;
  enrollment_closed_at: Date | string | null;
  follow_up_count: string | number | bigint;
  last_follow_up_at: Date | string | null;
  next_follow_up_at: Date | string | null;
  follow_up_paused_at: Date | string | null;
  responsible: string | null;
  conversation_id: string | null;
  conversation_status: string | null;
  unread_count: string | number | bigint;
  created_at: Date | string;
  updated_at: Date | string;
};

type OriginRow = { label: string | null; value: string | number | bigint };
type StageRow = { label: string | null; value: string | number | bigint };
type SellerRow = { seller: string | null; closed: string | number | bigint; revenue: string | number | bigint };

const stageMap: Record<string, string> = {
  novo: "novo",
  ia: "ia",
  qualificado: "atendimento",
  atendimento: "atendimento",
  orcamento: "atendimento",
  negociacao: "followup",
  interessado: "followup",
  followup: "followup",
  matricula_pendente: "matricula_pendente",
  matricula_realizada: "matricula_realizada",
  fechado: "matricula_realizada",
  perdido: "perdido"
};

const queryStageMap: Record<string, string[]> = {
  novo: ["novo"],
  ia: ["ia"],
  atendimento: ["atendimento", "qualificado", "orcamento"],
  followup: ["followup", "negociacao", "interessado", "interessado_followup"],
  matricula_pendente: ["matricula_pendente", "agendado"],
  matricula_realizada: ["fechado", "matricula_realizada"],
  perdido: ["perdido"]
};

function toNumber(value: string | number | bigint | null | undefined) {
  return Number(value ?? 0);
}

function toDbDate(value: Date) {
  return value.toISOString();
}

function dateLabel(value: Date | string | null) {
  if (!value) return "Sem interacao";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMinutes < 2) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min atras`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h atras`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ontem";
  return `${diffDays} dias atras`;
}

function normalizeStageLabel(stage: string | null | undefined) {
  return stageMap[stage ?? ""] ?? "novo";
}

function buildWhere(params: LeadQueryParams) {
  const clauses = [sql`l.is_deleted = false`];
  const search = params.search?.trim();

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    clauses.push(sql`(
      lower(coalesce(l.name, '')) like ${term}
      or lower(l.phone) like ${term}
      or lower(coalesce(l.origin, '')) like ${term}
      or lower(coalesce(l.last_message_preview, '')) like ${term}
      or lower(coalesce(u.name, '')) like ${term}
      or lower(coalesce(l.interest, '')) like ${term}
    )`);
  }

  if (params.origin && params.origin !== "Todos" && params.origin !== "Todas") {
    clauses.push(sql`lower(l.origin) = ${params.origin.toLowerCase()}`);
  }

  if (params.stage && params.stage !== "todos") {
    const dbStages = queryStageMap[params.stage] ?? [params.stage];
    clauses.push(sql`l.pipeline_stage in (${sql.join(dbStages.map((stage) => sql`${stage}`), sql`, `)})`);
  }

  if (params.temperature && params.temperature !== "todos") {
    clauses.push(sql`l.temperature = ${params.temperature}`);
  }

  if (params.sentiment && params.sentiment !== "todos") {
    clauses.push(sql`l.sentiment = ${params.sentiment}`);
  }

  if (params.seller && params.seller !== "Todos") {
    clauses.push(sql`coalesce(u.name, 'Sem responsavel') = ${params.seller}`);
  }

  if (params.start && params.end) {
    clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) >= ${toDbDate(params.start)}`);
    clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) < ${toDbDate(params.end)}`);
  }

  switch (params.quick) {
    case "quentes":
      clauses.push(sql`l.temperature in ('quente', 'urgente')`);
      break;
    case "sem_resposta":
      clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) < now() - interval '24 hours'`);
      break;
    case "ia":
      clauses.push(sql`c.status = 'ai'`);
      break;
    case "matriculas":
      clauses.push(sql`l.pipeline_stage in ('matricula_pendente', 'fechado')`);
      break;
    case "hoje":
      clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) >= date_trunc('day', now())`);
      break;
    case "whatsapp":
      clauses.push(sql`lower(l.origin) = 'whatsapp'`);
      break;
    case "meta":
      clauses.push(sql`lower(l.origin) in ('meta ads', 'facebook ads', 'instagram ads', 'facebook', 'instagram')`);
      break;
  }

  return sql.join(clauses, sql` and `);
}

export async function queryLeads(params: LeadQueryParams = {}) {
  const where = buildWhere(params);
  const limit = Math.min(Math.max(params.limit ?? 250, 1), 500);

  const rows = await db.execute(sql`
    select
      l.id,
      l.name,
      l.phone,
      l.avatar_url as avatar,
      l.origin,
      l.interest,
      l.temperature,
      l.sentiment,
      l.commercial_status,
      l.pipeline_stage,
      l.last_message_preview,
      l.last_interaction_at,
      l.enrollment_closed_at,
      l.follow_up_count,
      l.last_follow_up_at,
      l.next_follow_up_at,
      l.follow_up_paused_at,
      coalesce(u.name, 'Equipe comercial') as responsible,
      c.id as conversation_id,
      c.status as conversation_status,
      0 as unread_count,
      l.created_at,
      l.updated_at
    from leads l
    left join users u on u.id = l.responsible_id
    left join lateral (
      select id, status
      from conversations
      where lead_id = l.id and is_deleted = false
      order by last_message_at desc
      limit 1
    ) c on true
    where ${where}
    order by coalesce(l.last_interaction_at, l.updated_at, l.created_at) desc
    limit ${limit}
  `) as LeadRow[];

  return rows.map((lead) => {
    const name = lead.name ?? `Lead ${lead.phone.slice(-4)}`;
    const status = stageMap[lead.pipeline_stage] ?? "novo";

    return {
      id: lead.id,
      name,
      phone: lead.phone,
      avatar: lead.avatar ?? undefined,
      origin: lead.origin,
      status,
      temperature: lead.temperature,
      sentiment: lead.sentiment,
      commercialStatus: lead.commercial_status,
      lastMessage: lead.last_message_preview ?? "Mensagem registrada pelo WhatsApp.",
      lastInteraction: dateLabel(lead.last_interaction_at ?? lead.updated_at),
      responsible: lead.responsible ?? "Equipe comercial",
      initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      notes: lead.last_message_preview ?? "Lead sincronizado do banco de dados.",
      interest: lead.interest ?? "carro",
      conversationId: lead.conversation_id,
      conversationStatus: lead.conversation_status,
      followUpCount: toNumber(lead.follow_up_count),
      lastFollowUpAt: lead.last_follow_up_at ? new Date(lead.last_follow_up_at).toISOString() : null,
      nextFollowUpAt: lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toISOString() : null,
      followUpPausedAt: lead.follow_up_paused_at ? new Date(lead.follow_up_paused_at).toISOString() : null,
      createdAt: new Date(lead.created_at).toISOString(),
      updatedAt: new Date(lead.updated_at).toISOString()
    };
  });
}

export async function queryLeadAnalytics(params: LeadQueryParams = {}) {
  const where = buildWhere(params);

  const [origins, stages, sellers] = await Promise.all([
    db.execute(sql`
      select coalesce(nullif(l.origin, ''), 'Nao informado') as label, count(*) as value
      from leads l
      left join users u on u.id = l.responsible_id
      left join lateral (
        select id, status
        from conversations
        where lead_id = l.id and is_deleted = false
        order by last_message_at desc
        limit 1
      ) c on true
      where ${where}
      group by coalesce(nullif(l.origin, ''), 'Nao informado')
      order by value desc
    `) as Promise<OriginRow[]>,
    db.execute(sql`
      select coalesce(nullif(l.pipeline_stage, ''), 'novo') as label, count(*) as value
      from leads l
      left join users u on u.id = l.responsible_id
      left join lateral (
        select id, status
        from conversations
        where lead_id = l.id and is_deleted = false
        order by last_message_at desc
        limit 1
      ) c on true
      where ${where}
      group by coalesce(nullif(l.pipeline_stage, ''), 'novo')
      order by value desc
    `) as Promise<StageRow[]>,
    db.execute(sql`
      select coalesce(u.name, 'Sem responsavel') as seller, count(*) filter (where l.pipeline_stage = 'fechado') as closed, count(*) filter (where l.pipeline_stage = 'fechado') * 2400 as revenue
      from leads l
      left join users u on u.id = l.responsible_id
      left join lateral (
        select id, status
        from conversations
        where lead_id = l.id and is_deleted = false
        order by last_message_at desc
        limit 1
      ) c on true
      where ${where}
      group by coalesce(u.name, 'Sem responsavel')
      order by closed desc
    `) as Promise<SellerRow[]>
  ]);

  const normalizedStageTotals = new Map<string, number>();
  for (const item of stages) {
    const label = normalizeStageLabel(item.label);
    normalizedStageTotals.set(label, (normalizedStageTotals.get(label) ?? 0) + toNumber(item.value));
  }

  return {
    origins: origins.map((item) => ({ label: item.label ?? "Nao informado", value: toNumber(item.value) })),
    stages: Array.from(normalizedStageTotals.entries()).map(([label, value]) => ({ label, value })),
    sellers: sellers.map((item) => ({
      seller: item.seller ?? "Sem responsavel",
      closed: toNumber(item.closed),
      revenue: toNumber(item.revenue)
    }))
  };
}
