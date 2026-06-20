import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { queryLeadAnalytics, queryLeads, type LeadQueryParams } from "@/lib/services/lead-query-service";

export type ReportPeriod = {
  label: string;
  start: Date | null;
  end: Date | null;
};

export type ReportFilters = {
  start?: Date | null;
  end?: Date | null;
  origin?: string | null;
  seller?: string | null;
  limit?: number;
};

export type OriginMetric = { label: string; value: number; percent: number };
export type SellerMetric = { seller: string; closed: number; revenue: string; conversion: number; position: number; progress: number };
export type FunnelMetric = { etapa: string; value: number };
export type AiPerformanceMetric = { metric: string; value: number; detail: string };
export type MonthlyMetric = { month: string; leads: number; enrollments: number; revenue: number };
export type CampaignMetric = { campaign: string; leads: number; enrollments: number; conversion: number };
export type LossReasonMetric = { label: string; value: number; color: string };
export type CommercialPulseMetric = { label: string; time: string; kind: "enrollment" | "ai" | "hot" | "conversation" | "growth" };

type CountRow = { count: string | number | bigint };
type GroupRow = { label: string | null; value: string | number | bigint };
type SellerRow = { seller: string | null; closed: string | number | bigint; revenue: string | number | bigint };
type MonthlyRow = { month: string | number; leads?: string | number | bigint; enrollments?: string | number | bigint };
type ResponseRow = { seconds: string | number | bigint | null };

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DEFAULT_TICKET = 2400;

const stageLabels: Record<string, string> = {
  novo: "Novo",
  ia: "IA atendendo",
  atendimento: "Em atendimento",
  qualificado: "Em atendimento",
  orcamento: "Em atendimento",
  negociacao: "Follow-up",
  interessado: "Follow-up",
  interessado_followup: "Follow-up",
  followup: "Follow-up",
  matricula_pendente: "Matricula pendente",
  matricula_realizada: "Matricula realizada",
  fechado: "Matricula realizada",
  perdido: "Sem Retorno"
};

const funnelOrder = ["Novo", "IA atendendo", "Em atendimento", "Follow-up", "Matricula pendente", "Matricula realizada", "Perdido"];

function toNumber(value: string | number | bigint | null | undefined) {
  return Number(value ?? 0);
}

function toDbDate(value: Date) {
  return value.toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDashboardPeriod(period: string | null): ReportPeriod {
  const today = startOfToday();
  const normalized = (period ?? "Hoje").toLowerCase();

  if (normalized.includes("todo")) return { label: "Todo o periodo", start: null, end: null };
  if (normalized.includes("ontem")) return { label: "Ontem", start: addDays(today, -1), end: today };
  if (normalized.includes("30")) return { label: "Ultimos 30 dias", start: addDays(today, -29), end: addDays(today, 1) };
  if (normalized.includes("15")) return { label: "Ultimos 15 dias", start: addDays(today, -14), end: addDays(today, 1) };
  if (normalized.includes("7")) return { label: "Ultimos 7 dias", start: addDays(today, -6), end: addDays(today, 1) };
  return { label: "Hoje", start: today, end: addDays(today, 1) };
}

function dateClause(column: ReturnType<typeof sql>, start?: Date | null, end?: Date | null) {
  if (!start || !end) return sql``;
  return sql` and ${column} >= ${toDbDate(start)} and ${column} < ${toDbDate(end)}`;
}

function baseLeadFilters(filters: ReportFilters) {
  const clauses = [sql`l.is_deleted = false`];

  if (filters.origin && filters.origin !== "Todas" && filters.origin !== "Todos") {
    clauses.push(sql`lower(coalesce(l.origin, '')) = ${filters.origin.toLowerCase()}`);
  }

  if (filters.seller && filters.seller !== "Todos") {
    clauses.push(sql`coalesce(u.name, 'Sem responsavel') = ${filters.seller}`);
  }

  if (filters.start && filters.end) {
    clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) >= ${toDbDate(filters.start)}`);
    clauses.push(sql`coalesce(l.last_interaction_at, l.updated_at, l.created_at) < ${toDbDate(filters.end)}`);
  }

  return sql.join(clauses, sql` and `);
}

async function countQuery(query: ReturnType<typeof sql>) {
  const rows = await db.execute(query) as CountRow[];
  return toNumber(rows[0]?.count);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatResponseTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Aguardando dados";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function normalizeStage(stage: string | null | undefined) {
  return stageLabels[stage ?? ""] ?? "Novo";
}

function toOriginMetrics(rows: GroupRow[]): OriginMetric[] {
  const total = rows.reduce((sum, row) => sum + toNumber(row.value), 0);
  return rows.map((row) => ({
    label: row.label ?? "Nao informado",
    value: toNumber(row.value),
    percent: total > 0 ? Math.round((toNumber(row.value) / total) * 100) : 0
  }));
}

async function getAverageResponseTime(filters: ReportFilters) {
  const range = dateClause(sql.raw("lead_message.created_at"), filters.start, filters.end);
  const rows = await db.execute(sql`
    select avg(extract(epoch from (reply_message.created_at - lead_message.created_at))) as seconds
    from messages lead_message
    join conversations c on c.id = lead_message.conversation_id and c.is_deleted = false
    join leads l on l.id = c.lead_id and l.is_deleted = false
    left join users u on u.id = l.responsible_id
    join lateral (
      select created_at
      from messages
      where conversation_id = lead_message.conversation_id
        and role in ('ai', 'human')
        and created_at > lead_message.created_at
      order by created_at asc
      limit 1
    ) reply_message on true
    where lead_message.role = 'lead'
      ${range}
      and ${baseLeadFilters({ ...filters, start: null, end: null })}
  `) as ResponseRow[];

  return toNumber(rows[0]?.seconds);
}

async function queryOrigins(filters: ReportFilters) {
  const rows = await db.execute(sql`
    select coalesce(nullif(l.origin, ''), 'Nao informado') as label, count(*) as value
    from leads l
    left join users u on u.id = l.responsible_id
    where ${baseLeadFilters(filters)}
    group by coalesce(nullif(l.origin, ''), 'Nao informado')
    order by value desc
    limit 6
  `) as GroupRow[];

  return toOriginMetrics(rows);
}

async function queryFunnel(filters: ReportFilters) {
  const rows = await db.execute(sql`
    select coalesce(nullif(l.pipeline_stage, ''), 'novo') as label, count(*) as value
    from leads l
    left join users u on u.id = l.responsible_id
    where ${baseLeadFilters(filters)}
    group by coalesce(nullif(l.pipeline_stage, ''), 'novo')
  `) as GroupRow[];

  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = normalizeStage(row.label);
    totals.set(label, (totals.get(label) ?? 0) + toNumber(row.value));
  }

  return funnelOrder
    .map((etapa) => ({ etapa, value: totals.get(etapa) ?? 0 }))
    .filter((item) => item.value > 0);
}

async function querySellers(filters: ReportFilters, totalLeads: number) {
  const rows = await db.execute(sql`
    select
      coalesce(u.name, 'Sem responsavel') as seller,
      count(*) filter (where l.pipeline_stage in ('fechado', 'matricula_realizada')) as closed,
      count(*) filter (where l.pipeline_stage in ('fechado', 'matricula_realizada')) * ${DEFAULT_TICKET} as revenue
    from leads l
    left join users u on u.id = l.responsible_id
    where ${baseLeadFilters(filters)}
    group by coalesce(u.name, 'Sem responsavel')
    order by closed desc, seller asc
  `) as SellerRow[];

  const maxClosed = Math.max(1, ...rows.map((row) => toNumber(row.closed)));
  return rows.map((row, index) => {
    const closed = toNumber(row.closed);
    return {
      seller: row.seller ?? "Sem responsavel",
      closed,
      revenue: formatCurrency(toNumber(row.revenue)),
      conversion: totalLeads > 0 ? Math.round((closed / totalLeads) * 100) : 0,
      position: index + 1,
      progress: closed > 0 ? Math.max(8, Math.round((closed / maxClosed) * 100)) : 0
    };
  });
}

async function queryMonthly(filters: ReportFilters) {
  const year = (filters.start ?? new Date()).getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const originSellerFilter = baseLeadFilters({ ...filters, start: null, end: null });

  const rows = await db.execute(sql`
    with months as (
      select generate_series(1, 12) as month
    ),
    lead_counts as (
      select extract(month from l.created_at)::int as month, count(*) as leads
      from leads l
      left join users u on u.id = l.responsible_id
      where l.created_at >= ${toDbDate(start)} and l.created_at < ${toDbDate(end)} and ${originSellerFilter}
      group by 1
    ),
    enrollment_counts as (
      select extract(month from coalesce(l.enrollment_closed_at, l.updated_at))::int as month, count(*) as enrollments
      from leads l
      left join users u on u.id = l.responsible_id
      where coalesce(l.enrollment_closed_at, l.updated_at) >= ${toDbDate(start)}
        and coalesce(l.enrollment_closed_at, l.updated_at) < ${toDbDate(end)}
        and l.pipeline_stage in ('fechado', 'matricula_realizada')
        and ${originSellerFilter}
      group by 1
    )
    select m.month, coalesce(lc.leads, 0) as leads, coalesce(ec.enrollments, 0) as enrollments
    from months m
    left join lead_counts lc on lc.month = m.month
    left join enrollment_counts ec on ec.month = m.month
    order by m.month
  `) as MonthlyRow[];

  return rows.map((row) => {
    const enrollments = toNumber(row.enrollments);
    return {
      month: MONTHS[toNumber(row.month) - 1] ?? String(row.month),
      leads: toNumber(row.leads),
      enrollments,
      revenue: enrollments * DEFAULT_TICKET
    };
  });
}

async function queryAiPerformance(filters: ReportFilters) {
  const where = baseLeadFilters(filters);
  const [totalConversations, aiConversations, humanConversations, qualifiedLeads, totalLeads, responseSeconds] = await Promise.all([
    countQuery(sql`
      select count(*) as count
      from conversations c
      join leads l on l.id = c.lead_id
      left join users u on u.id = l.responsible_id
      where c.is_deleted = false and ${where}
    `),
    countQuery(sql`
      select count(*) as count
      from conversations c
      join leads l on l.id = c.lead_id
      left join users u on u.id = l.responsible_id
      where c.is_deleted = false and c.status = 'ai' and ${where}
    `),
    countQuery(sql`
      select count(*) as count
      from conversations c
      join leads l on l.id = c.lead_id
      left join users u on u.id = l.responsible_id
      where c.is_deleted = false and c.status = 'human' and ${where}
    `),
    countQuery(sql`
      select count(*) as count
      from leads l
      left join users u on u.id = l.responsible_id
      where l.temperature in ('quente', 'urgente') and ${where}
    `),
    countQuery(sql`
      select count(*) as count
      from leads l
      left join users u on u.id = l.responsible_id
      where ${where}
    `),
    getAverageResponseTime(filters)
  ]);

  const aiRate = totalConversations > 0 ? Math.round((aiConversations / totalConversations) * 100) : 0;
  const handoffRate = totalConversations > 0 ? Math.round((humanConversations / totalConversations) * 100) : 0;
  const fastResponseRate = responseSeconds > 0 ? (responseSeconds <= 60 ? 100 : Math.max(0, Math.round(100 - responseSeconds / 6))) : 0;
  const qualifiedRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

  return [
    { metric: "Resolucao pela IA", value: aiRate, detail: totalConversations ? "conversas em modo automatico" : "Aguardando dados" },
    { metric: "Handoff correto", value: handoffRate, detail: totalConversations ? "atendimentos assumidos por humano" : "Aguardando dados" },
    { metric: "Resposta em ate 1 min", value: fastResponseRate, detail: responseSeconds > 0 ? formatResponseTime(responseSeconds) : "Aguardando dados" },
    { metric: "Leads qualificados", value: qualifiedRate, detail: totalLeads ? "temperatura quente ou urgente" : "Aguardando dados" }
  ];
}

async function queryCommercialPulse(filters: ReportFilters): Promise<CommercialPulseMetric[]> {
  const rows = await db.execute(sql`
    select
      coalesce(l.name, 'Lead ' || right(l.phone, 4)) as label,
      l.pipeline_stage,
      l.temperature,
      coalesce(l.last_interaction_at, l.updated_at, l.created_at) as occurred_at
    from leads l
    left join users u on u.id = l.responsible_id
    where ${baseLeadFilters(filters)}
    order by coalesce(l.last_interaction_at, l.updated_at, l.created_at) desc
    limit 5
  `) as Array<{ label: string; pipeline_stage: string | null; temperature: string | null; occurred_at: Date | string }>;

  return rows.map((row) => {
    const stage = row.pipeline_stage ?? "";
    const hot = row.temperature === "quente" || row.temperature === "urgente";
    const kind: CommercialPulseMetric["kind"] = stage === "fechado" || stage === "matricula_realizada"
      ? "enrollment"
      : hot
        ? "hot"
        : stage === "ia"
          ? "ai"
          : "conversation";
    return {
      label: stage === "fechado" || stage === "matricula_realizada"
        ? `${row.label} fechou matricula`
        : hot
          ? `Lead quente: ${row.label}`
          : `Conversa atualizada: ${row.label}`,
      time: timeAgo(row.occurred_at),
      kind
    };
  });
}

function timeAgo(value: Date | string) {
  const date = new Date(value);
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function classifyLossReason(text: string | null | undefined) {
  const value = (text ?? "").toLowerCase();
  if (value.includes("preco") || value.includes("valor") || value.includes("caro")) return "Preco";
  if (value.includes("resposta") || value.includes("sumiu") || value.includes("retorno")) return "Sem resposta";
  if (value.includes("horario") || value.includes("tempo")) return "Horario";
  if (value.includes("concorr")) return "Concorrente";
  if (value.includes("document")) return "Documentacao";
  return "Nao informado";
}

async function queryLossReasons(filters: ReportFilters): Promise<LossReasonMetric[]> {
  const rows = await db.execute(sql`
    select l.last_message_preview as label, count(*) as value
    from leads l
    left join users u on u.id = l.responsible_id
    where l.pipeline_stage = 'perdido' and ${baseLeadFilters(filters)}
    group by l.last_message_preview
  `) as GroupRow[];

  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = classifyLossReason(row.label);
    totals.set(label, (totals.get(label) ?? 0) + toNumber(row.value));
  }

  const colors = ["bg-red-400", "bg-yellow-300", "bg-sky-400", "bg-violet-400", "bg-emerald-400", "bg-slate-300"];
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(totals.entries()).map(([label, value], index) => ({
    label,
    value: total > 0 ? Math.round((value / total) * 100) : 0,
    color: colors[index % colors.length]
  }));
}

async function querySummaryMetrics(filters: ReportFilters) {
  const rows = await db.execute(sql`
    select
      count(*) as total_leads,
      count(*) filter (where l.pipeline_stage in ('fechado', 'matricula_realizada')) as enrollments,
      count(*) filter (where l.temperature in ('quente', 'urgente')) as hot_leads,
      count(*) filter (where c.status = 'ai') as ai_handled,
      count(*) filter (where c.status in ('ai', 'human')) as active_conversations
    from leads l
    left join users u on u.id = l.responsible_id
    left join lateral (
      select status
      from conversations
      where lead_id = l.id and is_deleted = false
      order by last_message_at desc
      limit 1
    ) c on true
    where ${baseLeadFilters(filters)}
  `) as Array<{
    total_leads: string | number | bigint;
    enrollments: string | number | bigint;
    hot_leads: string | number | bigint;
    ai_handled: string | number | bigint;
    active_conversations: string | number | bigint;
  }>;

  const row = rows[0];
  const totalLeads = toNumber(row?.total_leads);
  const enrollments = toNumber(row?.enrollments);
  const revenue = enrollments * DEFAULT_TICKET;

  return {
    totalLeads,
    enrollments,
    revenue,
    conversion: totalLeads > 0 ? Number(((enrollments / totalLeads) * 100).toFixed(1)) : 0,
    averageTicket: enrollments > 0 ? Math.round(revenue / enrollments) : 0,
    aiHandled: toNumber(row?.ai_handled),
    activeConversations: toNumber(row?.active_conversations),
    hotLeads: toNumber(row?.hot_leads)
  };
}

export async function queryCommercialMetrics(filters: ReportFilters) {
  const queryParams: LeadQueryParams = {
    search: null,
    origin: filters.origin ?? null,
    seller: filters.seller ?? null,
    start: filters.start ?? null,
    end: filters.end ?? null,
    limit: filters.limit ?? 500
  };

  const [leads, analytics, origins, funnelData, monthlyReport, aiPerformance, responseSeconds, commercialPulse, lossReasons, summaryMetrics] = await Promise.all([
    queryLeads(queryParams),
    queryLeadAnalytics(queryParams),
    queryOrigins(filters),
    queryFunnel(filters),
    queryMonthly(filters),
    queryAiPerformance(filters),
    getAverageResponseTime(filters),
    queryCommercialPulse(filters),
    queryLossReasons(filters),
    querySummaryMetrics(filters)
  ]);

  const {
    totalLeads,
    enrollments,
    revenue,
    conversion,
    averageTicket,
    aiHandled,
    activeConversations,
    hotLeads
  } = summaryMetrics;
  const sellers = await querySellers(filters, totalLeads);
  const campaigns: CampaignMetric[] = origins.map((origin) => {
    const enrollmentsByOrigin = leads.filter((lead) => lead.origin === origin.label && lead.status === "matricula_realizada").length;
    return {
      campaign: origin.label,
      leads: origin.value,
      enrollments: enrollmentsByOrigin,
      conversion: origin.value > 0 ? Number(((enrollmentsByOrigin / origin.value) * 100).toFixed(1)) : 0
    };
  });

  const temperatureTotal = analytics.stages.reduce((sum, item) => sum + item.value, 0);

  return {
    leads,
    analytics,
    summary: {
      totalLeads,
      enrollments,
      revenue,
      conversion,
      averageTicket,
      aiHandled,
      activeConversations,
      hotLeads,
      responseTime: formatResponseTime(responseSeconds)
    },
    stats: {
      leadsHoje: totalLeads,
      conversasAtivas: activeConversations,
      matriculasFechadas: enrollments,
      taxaConversao: conversion,
      iaAtendendo: aiHandled,
      leadsQuentes: hotLeads,
      tempoMedioResposta: formatResponseTime(responseSeconds),
      vendasMes: formatCurrency(revenue)
    },
    thermometer: {
      total: temperatureTotal,
      items: analytics.stages
    },
    leadsByOrigin: origins,
    sellerClosing: sellers,
    funnelData,
    aiPerformance,
    monthlyReport,
    monthlyConversion: monthlyReport.map((item) => ({
      month: item.month,
      leads: item.leads,
      enrollments: item.enrollments
    })),
    campaignConversion: campaigns,
    lossReasons,
    commercialPulse
  };
}

export function createPdfBuffer(lines: string[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const startY = 800;
  const lineHeight = 16;
  const maxLinesPerPage = Math.floor((startY - 54) / lineHeight);
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  const fontObjectId = 3 + pages.length * 2;
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  pages.forEach((pageLines, pageIndex) => {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const content = [
      "BT",
      "/F1 11 Tf",
      `1 0 0 1 ${marginX} ${startY} Tm`,
      ...pageLines.flatMap((line, lineIndex) => {
        const font = lineIndex === 0 && pageIndex === 0 ? "/F1 18 Tf" : "/F1 11 Tf";
        const text = line === "" ? " " : line;
        return [font, `(${escapePdfText(text)}) Tj`, `0 -${lineHeight} Td`];
      }),
      "ET"
    ].join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(header.length + body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = header.length + body.length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  return Buffer.from(header + body + xref);
}

function escapePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
