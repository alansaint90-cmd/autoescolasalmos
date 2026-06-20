import { desc, eq, sql } from "drizzle-orm";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { conversations, leads, messages } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { generateAiFollowUp } from "@/lib/services/ai-agent";
import { logAiDecision } from "@/lib/services/ai-decision-log-service";
import { createCrmNotification } from "@/lib/services/crm-notification-service";
import { normalizeEvolutionSendResults, sanitizeWhatsAppText, sendWhatsAppText } from "@/lib/services/evolution-api";
import { moveLeadStage } from "@/lib/services/funnel-stage-service";
import { appendRecentConversationContext, getRecentConversationContext } from "@/lib/services/message-buffer";
import { publishRealtimeEvent } from "@/lib/services/realtime";
import { logSystemEvent } from "@/lib/services/system-event-log-service";

type DueFollowUpRow = {
  conversation_id: string;
  lead_id: string;
  lead_name: string | null;
  phone: string;
  conversation_status: "ai" | "human" | "paused" | "closed";
  context_summary: string | null;
  follow_up_count: number;
  next_follow_up_at: Date | string | null;
  follow_up_paused_at: Date | string | null;
  pipeline_stage: string;
  last_interaction_at: Date | string | null;
  last_message_at: Date | string;
};

const followUpScheduleHours: Record<number, number> = {
  1: 2,
  2: 24,
  3: 72,
  4: 168,
  5: 360
};

let lastBackgroundFollowUpRunAt = 0;
let backgroundFollowUpPromise: Promise<unknown> | null = null;

export function isAutomaticFollowUpEnabled() {
  return env.FOLLOW_UP_AUTOMATION_ENABLED;
}

export function getNextFollowUpAt(followUpCount: number, from = new Date()) {
  const nextNumber = followUpCount + 1;
  const hours = followUpScheduleHours[nextNumber];
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function triggerDueFollowUpsInBackground(options: {
  source?: string;
  limit?: number;
  minIntervalMs?: number;
} = {}) {
  if (!isAutomaticFollowUpEnabled()) return;

  const now = Date.now();
  const minIntervalMs = options.minIntervalMs ?? 60_000;
  if (backgroundFollowUpPromise || now - lastBackgroundFollowUpRunAt < minIntervalMs) return;

  lastBackgroundFollowUpRunAt = now;
  backgroundFollowUpPromise = processDueFollowUps(options.limit ?? 10)
    .then((result) => {
      if (result.processed > 0 || result.failed > 0) {
        console.info("[follow-up] background run finished", {
          source: options.source ?? "auto",
          processed: result.processed,
          failed: result.failed
        });
      }
    })
    .catch((error) => {
      console.error("[follow-up] background run failed", {
        source: options.source ?? "auto",
        error
      });
    })
    .finally(() => {
      backgroundFollowUpPromise = null;
    });
}

export async function scheduleLeadFollowUp(leadId: string, from = new Date()) {
  if (!isAutomaticFollowUpEnabled()) {
    await pauseLeadFollowUp(leadId);
    return;
  }

  const nextFollowUpAt = getNextFollowUpAt(0, from);

  await db.execute(sql`
    update leads
    set
      follow_up_count = 0,
      last_follow_up_at = null,
      next_follow_up_at = ${toDbTimestamp(nextFollowUpAt)},
      follow_up_paused_at = null,
      updated_at = now(),
      modified_by = ${SYSTEM_USER_ID}
    where id = ${leadId}
      and is_deleted = false
      and pipeline_stage not in ('fechado', 'perdido', 'matricula_pendente')
  `);
}

export async function pauseLeadFollowUp(leadId: string, userId = SYSTEM_USER_ID) {
  await db.execute(sql`
    update leads
    set
      next_follow_up_at = null,
      follow_up_paused_at = now(),
      updated_at = now(),
      modified_by = ${userId}
    where id = ${leadId}
      and is_deleted = false
  `);
}

export async function resumeLeadFollowUp(leadId: string, userId = SYSTEM_USER_ID) {
  if (!isAutomaticFollowUpEnabled()) {
    await pauseLeadFollowUp(leadId, userId);
    return;
  }

  const nextFollowUpAt = getNextFollowUpAt(0);

  await db.execute(sql`
    update leads
    set
      next_follow_up_at = ${toDbTimestamp(nextFollowUpAt)},
      follow_up_paused_at = null,
      updated_at = now(),
      modified_by = ${userId}
    where id = ${leadId}
      and is_deleted = false
      and pipeline_stage not in ('fechado', 'perdido', 'matricula_pendente')
  `);
}

export async function resetLeadFollowUpOnCustomerReply(leadId: string) {
  await db.execute(sql`
    update leads
    set
      follow_up_count = 0,
      last_follow_up_at = null,
      next_follow_up_at = null,
      follow_up_paused_at = null,
      updated_at = now(),
      modified_by = ${SYSTEM_USER_ID}
    where id = ${leadId}
      and is_deleted = false
  `);
}

export async function processDueFollowUps(limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  if (!isAutomaticFollowUpEnabled()) {
    await logSystemEvent({
      source: "follow-up-job",
      event: "follow_up_automation_disabled",
      severity: "info",
      message: "Follow-up automatico desativado por configuracao.",
      metadata: {
        limit: safeLimit,
        env: "FOLLOW_UP_AUTOMATION_ENABLED"
      }
    });

    return {
      processed: 0,
      failed: 0,
      dueCount: 0,
      disabled: true,
      errors: [],
      results: []
    };
  }

  const dueLeads = await queryDueFollowUps(safeLimit);

  const results = [];
  const errors: Array<{ leadId: string; conversationId: string; error: string }> = [];
  for (const dueLead of dueLeads) {
    try {
      results.push(await sendFollowUpForConversation(dueLead));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao enviar follow-up.";
      errors.push({
        leadId: dueLead.lead_id,
        conversationId: dueLead.conversation_id,
        error: message
      });

      await markDueFollowUpAsVisible(dueLead, message);
    }
  }

  await logSystemEvent({
    source: "follow-up-job",
    event: "follow_up_job_processed",
    severity: errors.length > 0 ? "warning" : results.length > 0 ? "success" : "info",
    message: results.length > 0 || errors.length > 0
      ? `${results.length} follow-up(s) automatico(s) enviado(s), ${errors.length} com falha.`
      : "Job de follow-up executado sem leads vencidos.",
    metadata: {
      dueCount: dueLeads.length,
      processed: results.length,
      failed: errors.length,
      limit: safeLimit,
      leadIds: results.map((result) => result.leadId),
      errors
    }
  });

  return {
    processed: results.length,
    failed: errors.length,
    dueCount: dueLeads.length,
    errors,
    results
  };
}

export async function previewDueFollowUps(limit = 25) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  if (!isAutomaticFollowUpEnabled()) {
    return {
      dueCount: 0,
      limit: safeLimit,
      disabled: true,
      dueLeads: []
    };
  }

  const dueLeads = await queryDueFollowUps(safeLimit);

  return {
    dueCount: dueLeads.length,
    limit: safeLimit,
    dueLeads: dueLeads.map((lead) => ({
      leadId: lead.lead_id,
      conversationId: lead.conversation_id,
      leadName: lead.lead_name,
      conversationStatus: lead.conversation_status,
      pipelineStage: lead.pipeline_stage,
      followUpCount: Number(lead.follow_up_count ?? 0),
      nextFollowUpAt: lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toISOString() : null,
      lastInteractionAt: lead.last_interaction_at ? new Date(lead.last_interaction_at).toISOString() : null,
      lastMessageAt: new Date(lead.last_message_at).toISOString()
    }))
  };
}

async function queryDueFollowUps(limit: number) {
  return db.execute<DueFollowUpRow>(sql`
    select
      c.id as conversation_id,
      c.status as conversation_status,
      l.id as lead_id,
      l.name as lead_name,
      l.phone,
      c.context_summary,
      l.follow_up_count,
      l.next_follow_up_at,
      l.follow_up_paused_at,
      l.pipeline_stage,
      l.last_interaction_at,
      c.last_message_at
    from leads l
    inner join conversations c on c.lead_id = l.id and c.is_deleted = false
    where l.is_deleted = false
      and c.status in ('ai', 'human')
      and l.follow_up_paused_at is null
      and (
        (l.next_follow_up_at is not null and l.next_follow_up_at <= now())
        or (
          l.next_follow_up_at is null
          and coalesce(l.follow_up_count, 0) = 0
          and coalesce(l.last_interaction_at, c.last_message_at) <= now() - interval '2 hours'
        )
      )
      and l.follow_up_count < 5
      and l.pipeline_stage not in ('fechado', 'perdido', 'matricula_pendente')
    order by l.next_follow_up_at asc
    limit ${limit}
  `);
}

async function markDueFollowUpAsVisible(target: DueFollowUpRow, errorMessage: string) {
  console.error("[follow-up] failed to process due lead", {
    leadId: target.lead_id,
    conversationId: target.conversation_id,
    error: errorMessage
  });

  const nextFollowUpAt = new Date(Date.now() + 15 * 60_000);

  await moveLeadStage({
    leadId: target.lead_id,
    toStage: "followup",
    conversationId: target.conversation_id,
    reason: "Lead atingiu prazo de follow-up, mas o envio automatico falhou e precisa de acompanhamento.",
    actor: "Sistema",
    updates: {
      next_follow_up_at: nextFollowUpAt,
      commercial_status: "pendente"
    }
  });

  await logSystemEvent({
    source: "follow-up-job",
    event: "follow_up_send_failed",
    severity: "error",
    message: errorMessage,
    leadId: target.lead_id,
    conversationId: target.conversation_id,
    metadata: {
      followUpCount: target.follow_up_count,
      nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null
    }
  });
}

export async function sendFollowUpNow(leadId: string) {
  const [target] = await db.execute<DueFollowUpRow>(sql`
    select
      c.id as conversation_id,
      c.status as conversation_status,
      l.id as lead_id,
      l.name as lead_name,
      l.phone,
      c.context_summary,
      l.follow_up_count,
      l.next_follow_up_at,
      l.follow_up_paused_at,
      l.pipeline_stage,
      l.last_interaction_at,
      c.last_message_at
    from leads l
    inner join conversations c on c.lead_id = l.id and c.is_deleted = false
    where l.id = ${leadId}
      and l.is_deleted = false
    order by c.last_message_at desc
    limit 1
  `);

  if (!target) {
    throw new Error("Lead ou conversa nao encontrado para follow-up.");
  }

  return sendFollowUpForConversation(target);
}

async function sendFollowUpForConversation(target: DueFollowUpRow) {
  const followUpNumber = Math.min(Number(target.follow_up_count ?? 0) + 1, 5);
  const recentContext = await getContext(target.conversation_id);
  const lastContactAt = target.last_interaction_at ?? target.last_message_at;
  const hoursWithoutResponse = Math.max(0, Math.round((Date.now() - new Date(lastContactAt).getTime()) / 3_600_000));

  const reply = await generateAiFollowUp({
    leadName: target.lead_name,
    contextSummary: target.context_summary,
    followUpNumber,
    hoursWithoutResponse,
    messages: recentContext
  });
  const cleanReply = sanitizeWhatsAppText(reply);

  const evolutionResults = normalizeEvolutionSendResults(await sendWhatsAppText({ phone: target.phone, text: cleanReply }));

  const [message] = await db
    .insert(messages)
    .values({
      conversation_id: target.conversation_id,
      external_message_id: evolutionResults[0]?.messageId,
      role: "ai",
      content: cleanReply,
      metadata: {
        source: "follow_up",
        followUpNumber,
        evolutionMessageKeys: evolutionResults.map((result) => result.key).filter(Boolean)
      },
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  const nextFollowUpAt = followUpNumber >= 5 ? null : getNextFollowUpAt(followUpNumber);
  const nextTemperature = followUpNumber >= 4 ? "frio" : followUpNumber >= 2 ? "morno" : "quente";
  const nextStage = followUpNumber >= 5 ? "perdido" : "followup";
  const commercialStatus = followUpNumber >= 5 ? "nao_venda" : followUpNumber >= 2 ? "pendente" : "em_atendimento";

  await logAiDecision({
    conversationId: target.conversation_id,
    leadId: target.lead_id,
    messageId: message.id,
    action: "follow_up_sent",
    reason: `Follow-up automatico ${followUpNumber} enviado apos ${hoursWithoutResponse} horas sem resposta.`,
    mode: "follow_up",
    metadata: {
      followUpNumber,
      hoursWithoutResponse,
      nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null
    }
  });

  await moveLeadStage({
    leadId: target.lead_id,
    toStage: nextStage,
    conversationId: target.conversation_id,
    messageId: message.id,
    reason: followUpNumber >= 5
      ? "Sequencia de follow-up encerrada sem resposta."
      : `Lead movido para Follow-up - sem resposta apos prazo configurado (${hoursWithoutResponse} horas).`,
    actor: "Sistema",
    updates: {
      follow_up_count: followUpNumber,
      last_follow_up_at: new Date(),
      next_follow_up_at: nextFollowUpAt,
      follow_up_paused_at: followUpNumber >= 5 ? new Date() : null,
      temperature: nextTemperature,
      commercial_status: commercialStatus,
      last_message_preview: cleanReply.slice(0, 280),
      last_interaction_at: new Date()
    }
  });

  await db
    .update(conversations)
    .set({
      last_message_at: new Date(),
      updated_at: new Date(),
      modified_by: SYSTEM_USER_ID
    })
    .where(eq(conversations.id, target.conversation_id));

  await appendRecentConversationContext({
    conversationId: target.conversation_id,
    messageId: message.id,
    role: "ai",
    content: cleanReply,
    createdAt: new Date().toISOString()
  });

  await publishRealtimeEvent({
    type: "message.created",
    conversationId: target.conversation_id,
    payload: { message, leadId: target.lead_id, followUpNumber }
  });

  if (followUpNumber === 2 || followUpNumber === 5) {
    await createCrmNotification({
      leadId: target.lead_id,
      conversationId: target.conversation_id,
      messageId: message.id,
      type: "pending_lead",
      title: followUpNumber >= 5 ? "Lead movido para Sem Retorno" : "Lead pendente sem resposta",
      body: followUpNumber >= 5
        ? "Lead recebeu 5 follow-ups automaticos sem resposta e foi marcado como nao venda."
        : "Lead sem resposta apos follow-up. Recomenda-se acao humana para recuperar a matricula.",
      payload: {
        followUpNumber,
        hoursWithoutResponse,
        nextFollowUpAt: nextFollowUpAt?.toISOString() ?? null,
        commercialStatus
      }
    });
  }

  return {
    leadId: target.lead_id,
    conversationId: target.conversation_id,
    followUpNumber,
    nextFollowUpAt,
    message: cleanReply
  };
}

function toDbTimestamp(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

async function getContext(conversationId: string) {
  const redisContext = await getRecentConversationContext(conversationId);
  if (redisContext.length > 0) {
    return redisContext.map((message) => ({ role: message.role, content: message.content }));
  }

  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversation_id, conversationId))
    .orderBy(desc(messages.created_at))
    .limit(20);

  return recentMessages.reverse().map((message) => ({
    role: message.role,
    content: message.content
  }));
}
