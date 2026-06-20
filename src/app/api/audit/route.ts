import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { aiDecisionLogs, crmNotifications, leads, systemEventLogs, users } from "@/lib/db/schema";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

type AuditPayloadRow = {
  id: string;
  type: "decision" | "event" | "notification";
  action: string;
  user: string;
  entity: string;
  date: string;
  isoDate: string;
  status: string;
  rawAction: string;
  reason: string;
  mode: string | null;
  safetyStatus: string;
  severity: string;
  metadata: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "viewTeamReports");

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 200), 1), 500);
    const [decisionRows, eventRows, notificationRows] = await Promise.all([
      db
        .select({
          id: aiDecisionLogs.id,
          action: aiDecisionLogs.action,
          reason: aiDecisionLogs.reason,
          mode: aiDecisionLogs.mode,
          safetyStatus: aiDecisionLogs.safety_status,
          metadata: aiDecisionLogs.metadata,
          createdAt: aiDecisionLogs.created_at,
          userName: sql<string>`coalesce(${users.name}, 'Sistema')`,
          leadName: sql<string>`coalesce(${leads.name}, 'Lead sem nome')`
        })
        .from(aiDecisionLogs)
        .leftJoin(users, eq(users.id, aiDecisionLogs.modified_by))
        .leftJoin(leads, eq(leads.id, aiDecisionLogs.lead_id))
        .where(eq(aiDecisionLogs.is_deleted, false))
        .orderBy(desc(aiDecisionLogs.created_at))
        .limit(limit),
      db
        .select({
          id: systemEventLogs.id,
          source: systemEventLogs.source,
          event: systemEventLogs.event,
          severity: systemEventLogs.severity,
          message: systemEventLogs.message,
          metadata: systemEventLogs.metadata,
          createdAt: systemEventLogs.created_at,
          leadName: sql<string>`coalesce(${leads.name}, 'Sem lead vinculado')`
        })
        .from(systemEventLogs)
        .leftJoin(leads, eq(leads.id, systemEventLogs.lead_id))
        .where(eq(systemEventLogs.is_deleted, false))
        .orderBy(desc(systemEventLogs.created_at))
        .limit(limit),
      db
        .select({
          id: crmNotifications.id,
          type: crmNotifications.type,
          title: crmNotifications.title,
          body: crmNotifications.body,
          status: crmNotifications.status,
          payload: crmNotifications.payload,
          createdAt: crmNotifications.created_at,
          leadName: sql<string>`coalesce(${leads.name}, 'Sem lead vinculado')`
        })
        .from(crmNotifications)
        .leftJoin(leads, eq(leads.id, crmNotifications.lead_id))
        .where(eq(crmNotifications.is_deleted, false))
        .orderBy(desc(crmNotifications.created_at))
        .limit(Math.min(limit, 100))
    ]);

    const decisions: AuditPayloadRow[] = decisionRows.map((row) => ({
      id: row.id,
      type: "decision",
      action: labelAction(row.action),
      user: row.userName,
      entity: row.action === "funnel_stage_changed" ? row.reason : `${row.leadName} - ${row.reason}`,
      date: formatDate(row.createdAt),
      isoDate: toIsoDate(row.createdAt),
      status: statusFromAction(row.action, row.safetyStatus),
      rawAction: row.action,
      reason: row.reason,
      mode: row.mode,
      safetyStatus: row.safetyStatus,
      severity: severityFromDecision(row.safetyStatus),
      metadata: row.metadata
    }));

    const events: AuditPayloadRow[] = eventRows.map((row) => ({
      id: row.id,
      type: "event",
      action: labelEvent(row.event, row.severity),
      user: row.source,
      entity: `${row.leadName} - ${row.message}`,
      date: formatDate(row.createdAt),
      isoDate: toIsoDate(row.createdAt),
      status: statusFromSeverity(row.severity),
      rawAction: row.event,
      reason: row.message,
      mode: row.source,
      safetyStatus: row.severity,
      severity: row.severity,
      metadata: row.metadata
    }));

    const notifications: AuditPayloadRow[] = notificationRows.map((row) => ({
      id: row.id,
      type: "notification",
      action: "Alerta CRM",
      user: "Sistema",
      entity: `${row.leadName} - ${row.title}: ${row.body}`,
      date: formatDate(row.createdAt),
      isoDate: toIsoDate(row.createdAt),
      status: row.status === "unread" ? "config" : "approved",
      rawAction: row.type,
      reason: row.body,
      mode: row.status,
      safetyStatus: row.status,
      severity: row.status === "unread" ? "warning" : "info",
      metadata: row.payload
    }));

    const combinedRows = [...events, ...decisions, ...notifications]
      .sort((first, second) => Date.parse(second.isoDate) - Date.parse(first.isoDate))
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      summary: buildSummary(decisions, events, notifications),
      rows: combinedRows.map(stripIsoDate),
      decisions: decisions.map(stripIsoDate),
      events: events.map(stripIsoDate),
      notifications: notifications.map(stripIsoDate)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar auditoria." },
      { status: 403 }
    );
  }
}

function stripIsoDate(row: AuditPayloadRow) {
  const { isoDate, ...payload } = row;
  return payload;
}

function formatDate(value: Date) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function toIsoDate(value: Date) {
  return new Date(value).toISOString();
}

function labelAction(action: string) {
  const labels: Record<string, string> = {
    funnel_stage_changed: "Funil",
    ai_reply_generated: "Resposta IA",
    ai_reply_blocked_by_safety: "Bloqueio",
    ai_reply_skipped_manual_mode: "Modo humano",
    ai_mode_skipped: "Triagem",
    ai_triage_applied: "Triagem",
    ai_qualified_lead: "Qualificado",
    human_handoff_triggered: "Handoff",
    ai_mode_restored: "IA ativa",
    follow_up_sent: "Follow-up"
  };
  return labels[action] ?? "Decisao IA";
}

function labelEvent(event: string, severity: string) {
  if (severity === "error") return "Erro";
  if (severity === "warning") return "Alerta";
  const labels: Record<string, string> = {
    message_registered: "Capturado",
    duplicate_message_ignored: "Duplicado",
    ignored_event: "Ignorado",
    unsupported_message: "Ignorado",
    buffer_processing_failed: "Erro",
    register_inbound_failed: "Erro"
  };
  return labels[event] ?? "Sistema";
}

function severityFromDecision(safetyStatus: string) {
  if (safetyStatus === "blocked") return "error";
  if (safetyStatus === "skipped" || safetyStatus === "fallback") return "warning";
  return "success";
}

function statusFromAction(action: string, safetyStatus: string) {
  if (safetyStatus === "blocked" || safetyStatus === "skipped") return "rejected";
  if (action === "funnel_stage_changed" || action === "ai_qualified_lead") return "approved";
  if (action === "ai_reply_generated" || action === "follow_up_sent") return "published";
  if (action.includes("triage")) return "captured";
  if (action.includes("handoff")) return "config";
  return "captured";
}

function statusFromSeverity(severity: string) {
  if (severity === "error") return "rejected";
  if (severity === "warning") return "config";
  if (severity === "success") return "approved";
  return "captured";
}

function buildSummary(
  decisions: AuditPayloadRow[],
  events: AuditPayloadRow[],
  notifications: AuditPayloadRow[]
) {
  const errors = events.filter((row) => row.severity === "error").length + decisions.filter((row) => row.severity === "error").length;
  const warnings = events.filter((row) => row.severity === "warning").length + decisions.filter((row) => row.severity === "warning").length;
  const aiReplies = decisions.filter((row) => row.rawAction === "ai_reply_generated").length;
  const handoffs = decisions.filter((row) => row.rawAction.includes("handoff")).length;
  const unreadNotifications = notifications.filter((row) => row.mode === "unread").length;

  return {
    total: decisions.length + events.length + notifications.length,
    decisions: decisions.length,
    errors,
    warnings,
    aiReplies,
    handoffs,
    unreadNotifications
  };
}
