import { and, eq, notInArray } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { logAiDecision } from "@/lib/services/ai-decision-log-service";

export type FunnelStage = "novo" | "ia" | "atendimento" | "followup" | "matricula_pendente" | "fechado" | "perdido";

type FunnelActor = "IA" | "Sistema" | "Operador";

type MoveLeadStageInput = {
  leadId: string;
  toStage: FunnelStage;
  reason: string;
  actor?: FunnelActor;
  conversationId?: string | null;
  messageId?: string | null;
  modifiedBy?: string;
  force?: boolean;
  allowedFrom?: FunnelStage[];
  updates?: Partial<Pick<
    typeof leads.$inferInsert,
    "commercial_status" | "temperature" | "sentiment" | "last_message_preview" | "last_interaction_at" | "enrollment_closed_at" | "follow_up_count" | "last_follow_up_at" | "next_follow_up_at" | "follow_up_paused_at"
  >>;
};

const terminalStages: FunnelStage[] = ["fechado", "perdido"];
const protectedOpenStages: FunnelStage[] = ["fechado", "perdido", "matricula_pendente"];

export async function moveLeadStage(input: MoveLeadStageInput) {
  const modifiedBy = input.modifiedBy ?? SYSTEM_USER_ID;
  const [current] = await db
    .select({
      id: leads.id,
      pipeline_stage: leads.pipeline_stage,
      commercial_status: leads.commercial_status
    })
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.is_deleted, false)))
    .limit(1);

  if (!current) {
    throw new Error("Lead nao encontrado para movimentacao do funil.");
  }

  const fromStage = normalizeFunnelStage(current.pipeline_stage);
  if (input.allowedFrom && !input.allowedFrom.includes(fromStage)) {
    return { moved: false, fromStage, toStage: fromStage, skipped: true };
  }
  if (!input.force && terminalStages.includes(fromStage) && fromStage !== input.toStage) {
    await logFunnelMove({ ...input, fromStage, skipped: true, modifiedBy });
    return { moved: false, fromStage, toStage: fromStage, skipped: true };
  }

  const stageChanged = fromStage !== input.toStage;
  const setValues: Partial<typeof leads.$inferInsert> = {
    ...input.updates,
    pipeline_stage: input.toStage,
    updated_at: new Date(),
    modified_by: modifiedBy
  };

  if (input.toStage === "fechado") {
    setValues.commercial_status = input.updates?.commercial_status ?? "venda";
    setValues.enrollment_closed_at = input.updates?.enrollment_closed_at ?? new Date();
    setValues.next_follow_up_at = null;
    setValues.follow_up_paused_at = input.updates?.follow_up_paused_at ?? new Date();
  }

  if (input.toStage === "perdido") {
    setValues.commercial_status = input.updates?.commercial_status ?? "nao_venda";
    setValues.next_follow_up_at = null;
    setValues.follow_up_paused_at = input.updates?.follow_up_paused_at ?? new Date();
  }

  await db
    .update(leads)
    .set(setValues)
    .where(and(eq(leads.id, input.leadId), eq(leads.is_deleted, false)));

  if (stageChanged) {
    await logFunnelMove({ ...input, fromStage, skipped: false, modifiedBy });
  }

  return { moved: stageChanged, fromStage, toStage: input.toStage, skipped: false };
}

export async function moveLeadStageIfOpen(input: MoveLeadStageInput) {
  const [current] = await db
    .select({ pipeline_stage: leads.pipeline_stage })
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.is_deleted, false), notInArray(leads.pipeline_stage, protectedOpenStages)))
    .limit(1);

  if (!current) return { moved: false, skipped: true };
  return moveLeadStage(input);
}

function normalizeFunnelStage(value: string | null | undefined): FunnelStage {
  if (value === "matricula_realizada") return "fechado";
  if (value === "qualificado" || value === "interessado" || value === "negociacao" || value === "orcamento") return "atendimento";
  if (value === "novo" || value === "ia" || value === "atendimento" || value === "followup" || value === "matricula_pendente" || value === "fechado" || value === "perdido") return value;
  return "novo";
}

async function logFunnelMove(input: MoveLeadStageInput & { fromStage: FunnelStage; skipped: boolean; modifiedBy: string }) {
  await logAiDecision({
    conversationId: input.conversationId ?? null,
    leadId: input.leadId,
    messageId: input.messageId ?? null,
    action: "funnel_stage_changed",
    reason: input.skipped
      ? `Movimentacao ignorada: lead em etapa terminal ${input.fromStage}. Motivo original: ${input.reason}`
      : `Lead movido de ${stageLabel(input.fromStage)} para ${stageLabel(input.toStage)} - ${input.reason}`,
    mode: input.toStage === "ia" ? "ai" : input.toStage === "followup" ? "follow_up" : input.toStage === "atendimento" ? "human" : null,
    safetyStatus: input.skipped ? "skipped" : "ok",
    metadata: {
      actor: input.actor ?? "Sistema",
      fromStage: input.fromStage,
      toStage: input.toStage,
      stageChanged: input.fromStage !== input.toStage,
      skipped: input.skipped
    },
    modifiedBy: input.modifiedBy
  });
}

function stageLabel(stage: FunnelStage) {
  const labels: Record<FunnelStage, string> = {
    novo: "Novo Lead",
    ia: "IA Atendendo",
    atendimento: "Em Atendimento",
    followup: "Follow-up",
    matricula_pendente: "Fechamento / Matricula Pendente",
    fechado: "Matricula Realizada",
    perdido: "Sem Retorno"
  };
  return labels[stage];
}
