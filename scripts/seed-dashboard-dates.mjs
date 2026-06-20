import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import postgres from "postgres";

try {
  loadEnvFile(".env");
} catch {
  // Production usually provides DATABASE_URL via environment variables.
}

const databaseUrl = process.env.DATABASE_URL ?? "postgres://auto_pro_ia:auto_pro_ia@localhost:5432/auto_pro_ia";
const systemUserId = "00000000-0000-0000-0000-000000000001";

const origins = ["WhatsApp", "Meta Ads", "Google Ads", "Instagram", "Site", "Indicacao"];
const temperatures = ["quente", "urgente", "morno", "frio"];
const sentiments = ["positivo", "duvida", "neutro", "negativo"];
const stages = ["novo", "ia", "atendimento", "followup", "matricula_pendente", "fechado"];
const interests = ["carro", "moto", "adicao", "mudanca"];

const leadNames = [
  "Lucas Ferreira",
  "Ana Beatriz",
  "Rafael Souza",
  "Mariana Lima",
  "Pedro Henrique",
  "Juliana Costa",
  "Bruno Almeida",
  "Camila Ribeiro",
  "Diego Martins",
  "Fernanda Dias",
  "Gabriel Rocha",
  "Isabela Nunes",
  "Renata Carvalho",
  "Joao Vitor",
  "Patricia Gomes",
  "Otavio Mendes",
  "Carla Santos",
  "Thiago Martins",
  "Sofia Barreto",
  "Rodrigo Teixeira",
  "Lais Andrade",
  "Marcos Paulo",
  "Bianca Rocha",
  "Andre Luiz",
  "Daniela Alves",
  "Felipe Costa",
  "Natalia Moura",
  "Gustavo Lima",
  "Priscila Torres",
  "Eduardo Nunes",
  "Amanda Freitas",
  "Caio Henrique",
  "Vitoria Ramos",
  "Leandro Souza",
  "Tatiane Dias",
  "Murilo Castro",
  "Elaine Martins",
  "Samuel Reis",
  "Aline Barbosa",
  "Igor Fernandes"
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days, hour = 10, minute = 0) {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function buildLead(index) {
  const dayBuckets = [
    0, 0, 0, 0, 0, 0,
    1, 1, 1, 1,
    2, 3, 4, 5, 6,
    7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 18, 20, 22, 24, 26, 29,
    31, 36, 42, 55, 70, 85, 100, 130
  ];
  const days = dayBuckets[index] ?? index;
  const stage = stages[index % stages.length];
  const isClosed = stage === "fechado" || index % 9 === 0;
  const createdAt = daysAgo(days, 9 + (index % 8), (index * 7) % 60);
  const interactionAt = daysAgo(Math.max(0, days - (index % 2)), 13 + (index % 6), (index * 11) % 60);

  return {
    name: leadNames[index],
    phone: `55759900${String(index + 1).padStart(4, "0")}`,
    externalChatId: `55759900${String(index + 1).padStart(4, "0")}@s.whatsapp.net`,
    origin: origins[index % origins.length],
    temperature: temperatures[index % temperatures.length],
    sentiment: sentiments[index % sentiments.length],
    pipelineStage: isClosed ? "fechado" : stage,
    interest: interests[index % interests.length],
    preview: isClosed
      ? "Matricula confirmada. Cliente concluiu o processo comercial."
      : index % 3 === 0
        ? "Cliente pediu valores e condicoes de parcelamento."
        : index % 3 === 1
          ? "Cliente aguarda retorno para confirmar horario de aula teorica."
          : "IA qualificou interesse e recomendou follow-up comercial.",
    createdAt,
    updatedAt: interactionAt,
    lastInteractionAt: interactionAt,
    enrollmentClosedAt: isClosed ? interactionAt : null,
    status: index % 4 === 0 ? "human" : "ai"
  };
}

async function ensureSystemUser(sql) {
  await sql`
    insert into users (
      id,
      name,
      email,
      role,
      is_deleted,
      modified_by
    )
    values (
      ${systemUserId},
      'Auto Pro IA',
      'sistema@autoproia.local',
      'admin',
      false,
      ${systemUserId}
    )
    on conflict (id) do update set
      name = excluded.name,
      role = excluded.role,
      is_deleted = false,
      modified_by = excluded.modified_by
  `;
}

async function ensureDashboardColumns(sql) {
  await sql`
    alter table leads
      add column if not exists temperature text not null default 'morno',
      add column if not exists sentiment text not null default 'neutro',
      add column if not exists commercial_status text not null default 'pendente',
      add column if not exists pipeline_stage text not null default 'novo',
      add column if not exists last_message_preview text,
      add column if not exists last_interaction_at timestamptz,
      add column if not exists enrollment_closed_at timestamptz,
      add column if not exists follow_up_count integer not null default 0,
      add column if not exists last_follow_up_at timestamptz,
      add column if not exists next_follow_up_at timestamptz,
      add column if not exists follow_up_paused_at timestamptz
  `;
}

async function upsertLead(sql, lead) {
  const [row] = await sql`
    insert into leads (
      name,
      phone,
      origin,
      interest,
      temperature,
      sentiment,
      pipeline_stage,
      commercial_status,
      last_message_preview,
      last_interaction_at,
      enrollment_closed_at,
      created_at,
      updated_at,
      is_deleted,
      modified_by
    )
    values (
      ${lead.name},
      ${lead.phone},
      ${lead.origin},
      ${lead.interest},
      ${lead.temperature},
      ${lead.sentiment},
      ${lead.pipelineStage},
      ${lead.pipelineStage === "fechado" ? "venda" : lead.pipelineStage === "perdido" ? "nao_venda" : "em_atendimento"},
      ${lead.preview},
      ${lead.lastInteractionAt},
      ${lead.enrollmentClosedAt},
      ${lead.createdAt},
      ${lead.updatedAt},
      false,
      ${systemUserId}
    )
    on conflict (phone) do update set
      name = excluded.name,
      origin = excluded.origin,
      interest = excluded.interest,
      temperature = excluded.temperature,
      sentiment = excluded.sentiment,
      pipeline_stage = excluded.pipeline_stage,
      commercial_status = excluded.commercial_status,
      last_message_preview = excluded.last_message_preview,
      last_interaction_at = excluded.last_interaction_at,
      enrollment_closed_at = excluded.enrollment_closed_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      is_deleted = false,
      modified_by = excluded.modified_by
    returning id
  `;

  return row.id;
}

async function upsertConversation(sql, lead, leadId) {
  const existing = await sql`
    select id
    from conversations
    where external_chat_id = ${lead.externalChatId}
      and is_deleted = false
    limit 1
  `;

  if (existing[0]) {
    await sql`
      update conversations
      set
        lead_id = ${leadId},
        status = ${lead.status},
        last_message_at = ${lead.lastInteractionAt},
        context_summary = ${`Seed dashboard: ${lead.temperature}, ${lead.sentiment}, ${lead.pipelineStage}.`},
        updated_at = ${lead.updatedAt},
        is_deleted = false,
        modified_by = ${systemUserId}
      where id = ${existing[0].id}
    `;

    return existing[0].id;
  }

  const [created] = await sql`
    insert into conversations (
      id,
      lead_id,
      channel,
      external_chat_id,
      status,
      last_message_at,
      context_summary,
      created_at,
      updated_at,
      is_deleted,
      modified_by
    )
    values (
      ${randomUUID()},
      ${leadId},
      'whatsapp',
      ${lead.externalChatId},
      ${lead.status},
      ${lead.lastInteractionAt},
      ${`Seed dashboard: ${lead.temperature}, ${lead.sentiment}, ${lead.pipelineStage}.`},
      ${lead.createdAt},
      ${lead.updatedAt},
      false,
      ${systemUserId}
    )
    returning id
  `;

  return created.id;
}

async function ensureMessages(sql, lead, conversationId, index) {
  const inboundExternalId = `seed-dashboard-${index + 1}-in`;
  const outboundExternalId = `seed-dashboard-${index + 1}-out`;
  const existingInbound = await sql`
    select id from messages
    where external_message_id = ${inboundExternalId}
    limit 1
  `;

  if (!existingInbound[0]) {
    await sql`
      insert into messages (
        conversation_id,
        external_message_id,
        role,
        content,
        metadata,
        created_at,
        updated_at,
        is_deleted,
        modified_by
      )
      values (
        ${conversationId},
        ${inboundExternalId},
        'lead',
        ${lead.preview},
        ${JSON.stringify({ source: "seed-dashboard-dates", origin: lead.origin })},
        ${lead.lastInteractionAt},
        ${lead.lastInteractionAt},
        false,
        ${systemUserId}
      )
    `;
  }

  const existingOutbound = await sql`
    select id from messages
    where external_message_id = ${outboundExternalId}
    limit 1
  `;

  if (!existingOutbound[0]) {
    await sql`
      insert into messages (
        conversation_id,
        external_message_id,
        role,
        content,
        metadata,
        created_at,
        updated_at,
        is_deleted,
        modified_by
      )
      values (
        ${conversationId},
        ${outboundExternalId},
        ${lead.status === "human" ? "human" : "ai"},
        ${lead.pipelineStage === "fechado" ? "Matricula registrada e conversa concluida." : "Atendimento registrado para teste dos filtros do dashboard."},
        ${JSON.stringify({ source: "seed-dashboard-dates" })},
        ${lead.updatedAt},
        ${lead.updatedAt},
        false,
        ${systemUserId}
      )
    `;
  }
}

async function main() {
  if (process.env.ALLOW_FAKE_DASHBOARD_SEED !== "true") {
    console.log("[seed-dashboard-dates] skipped. Set ALLOW_FAKE_DASHBOARD_SEED=true to create demo leads.");
    return;
  }

  const sql = postgres(databaseUrl, { prepare: false });
  const leads = leadNames.map((_, index) => buildLead(index));

  try {
    await ensureSystemUser(sql);
    await ensureDashboardColumns(sql);

    for (const [index, lead] of leads.entries()) {
      const leadId = await upsertLead(sql, lead);
      const conversationId = await upsertConversation(sql, lead, leadId);
      await ensureMessages(sql, lead, conversationId, index);
    }

    const summary = await sql`
      select
        count(*) filter (where created_at >= date_trunc('day', now())) as hoje,
        count(*) filter (where created_at >= date_trunc('day', now()) - interval '1 day' and created_at < date_trunc('day', now())) as ontem,
        count(*) filter (where created_at >= date_trunc('day', now()) - interval '6 days') as ultimos_7,
        count(*) filter (where created_at >= date_trunc('day', now()) - interval '14 days') as ultimos_15,
        count(*) filter (where created_at >= date_trunc('day', now()) - interval '29 days') as ultimos_30,
        count(*) as todo_periodo
      from leads
      where phone like '55759900%'
        and is_deleted = false
    `;

    console.log(JSON.stringify({
      ok: true,
      seededLeads: leads.length,
      dashboardFilterSample: summary[0],
      command: "npm run db:seed:dashboard"
    }, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[seed-dashboard-dates] failed", error);
  process.exitCode = 1;
});
