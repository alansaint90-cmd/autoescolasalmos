import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { aiDecisionLogs } from "@/lib/db/schema";

type AiDecisionAction =
  | "ai_reply_generated"
  | "ai_reply_blocked_by_safety"
  | "ai_reply_skipped_manual_mode"
  | "ai_reply_skipped_global_pause"
  | "ai_mode_skipped"
  | "ai_triage_applied"
  | "ai_qualified_lead"
  | "human_handoff_triggered"
  | "ai_mode_restored"
  | "follow_up_sent"
  | "funnel_stage_changed";

type LogAiDecisionInput = {
  conversationId?: string | null;
  leadId?: string | null;
  messageId?: string | null;
  action: AiDecisionAction;
  reason: string;
  model?: string | null;
  mode?: "ai" | "human" | "paused" | "closed" | "triage" | "follow_up" | null;
  safetyStatus?: "ok" | "blocked" | "skipped" | "fallback";
  metadata?: Record<string, unknown>;
  modifiedBy?: string;
};

export async function logAiDecision(input: LogAiDecisionInput) {
  try {
    await db.insert(aiDecisionLogs).values({
      conversation_id: input.conversationId ?? null,
      lead_id: input.leadId ?? null,
      message_id: input.messageId ?? null,
      action: input.action,
      reason: input.reason.slice(0, 1000),
      model: input.model ?? null,
      mode: input.mode ?? null,
      safety_status: input.safetyStatus ?? "ok",
      metadata: input.metadata ?? {},
      modified_by: input.modifiedBy ?? SYSTEM_USER_ID
    });
  } catch (error) {
    console.warn("[ai-decision-log] failed to persist decision", {
      action: input.action,
      conversationId: input.conversationId,
      leadId: input.leadId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
