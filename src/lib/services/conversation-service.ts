import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { conversations, handoffEvents, leads, messages, users } from "@/lib/db/schema";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import { generateAiReply, triageInitialConversation, type AiTriageResult } from "@/lib/services/ai-agent";
import { isWhatsAppAiPaused } from "@/lib/services/ai-control-service";
import { logAiDecision } from "@/lib/services/ai-decision-log-service";
import { transcribeInboundAudio, type AudioTranscriptionResult } from "@/lib/services/audio-transcription-service";
import { classifyCommercialSignal, type CommercialSignal } from "@/lib/services/commercial-status-service";
import { createCrmNotification } from "@/lib/services/crm-notification-service";
import { fetchWhatsAppProfilePicture, normalizeEvolutionSendResults, sanitizeWhatsAppText, sendWhatsAppText } from "@/lib/services/evolution-api";
import { moveLeadStage, moveLeadStageIfOpen, type FunnelStage } from "@/lib/services/funnel-stage-service";
import { describeInboundImage, type ImageDescriptionResult } from "@/lib/services/image-description-service";
import { processAndStoreInboundMedia, type InboundMediaProcessingResult } from "@/lib/services/inbound-media-service";
import { analyzeAndSavePaymentReceipt, isPotentialPixReceipt } from "@/lib/services/payment-receipt-service";
import {
  pauseLeadFollowUp,
  resetLeadFollowUpOnCustomerReply,
  resumeLeadFollowUp,
  scheduleLeadFollowUp
} from "@/lib/services/follow-up-service";
import {
  appendRecentConversationContext,
  clearConversationBuffer,
  drainConversationBuffer,
  getRecentConversationContext,
  pushToConversationBuffer,
  scheduleBufferProcessing,
  shouldProcessBuffer
} from "@/lib/services/message-buffer";
import { publishRealtimeEvent } from "@/lib/services/realtime";
import { logSystemEvent } from "@/lib/services/system-event-log-service";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/normalizer";

export async function registerInboundMessage(input: NormalizedInboundMessage) {
  await ensureSystemUser();

  const duplicated = await findDuplicatedEvolutionMessage(input.externalMessageId);
  if (duplicated) {
    console.info("[conversation-service] duplicated evolution message ignored", {
      conversationId: duplicated.conversation.id,
      externalMessageId: input.externalMessageId
    });
    return { ...duplicated, duplicated: true };
  }

  const mediaProcessing = await processInboundMedia(input);
  const inbound = mediaProcessing.textForAi
    ? { ...input, text: mediaProcessing.textForAi }
    : input;
  const inboundMedia = mediaProcessing.media?.media ?? inbound.media;

  let leadSignal = classifyLeadSignal(inbound.text);
  const lead = await upsertLead(inbound, leadSignal);
  const conversationState = await upsertConversation(lead.id, inbound.externalChatId);
  let conversation = conversationState.conversation;
  let triage: AiTriageResult | null = null;
  const shouldStartAiFlow = isAiEligibleInbound(inbound, lead.origin, conversationState.created);
  const whatsappAiPaused = !inbound.fromMe ? await isWhatsAppAiPaused() : false;
  const shouldReactivateAiFlow = !inbound.fromMe
    && !conversationState.created
    && conversation.status !== "ai"
    && isPaidTrafficEntryMessage(inbound.text)
    && !whatsappAiPaused;

  if (inbound.fromMe) {
    const humanControl = await applyWhatsAppHumanControl(conversation.id, lead.id, inbound);
    conversation = humanControl.conversation;
    leadSignal = { ...leadSignal, pipelineStage: "atendimento" };
  }

  if (shouldReactivateAiFlow) {
    const [reactivated] = await db
      .update(conversations)
      .set({
        status: "ai",
        ai_paused_reason: null,
        updated_at: new Date(),
        modified_by: SYSTEM_USER_ID
      })
      .where(and(eq(conversations.id, conversation.id), eq(conversations.is_deleted, false)))
      .returning();

    if (reactivated) {
      conversation = reactivated;
      await logAiDecision({
        conversationId: conversation.id,
        leadId: lead.id,
        action: "ai_mode_restored",
        reason: "Lead enviou o gatilho de anuncio em conversa existente; atendimento automatico reativado.",
        mode: "ai",
        safetyStatus: "ok",
        metadata: {
          sourcePolicy: "paid_entry_message_reactivation",
          trigger: inbound.text
        }
      });
    }
  }

  if (!inbound.fromMe && conversationState.created && !shouldStartAiFlow && conversation.status === "ai") {
    const manualQueue = await applyInitialManualQueue(
      conversation.id,
      lead.id,
      inbound,
      {
        reason: "Conversa fora da politica de entrada paga. IA pausada porque a primeira mensagem nao corresponde ao gatilho do anuncio.",
        context: "Politica atual: a IA inicia somente quando a primeira mensagem for: tenho interesse, gostaria de mais informacoes por favor.",
        logReason: "Conversa em modo automatico foi pausada porque nao possui a frase inicial validada de trafego pago."
      }
    );
    conversation = manualQueue.conversation;
    leadSignal = { ...leadSignal, pipelineStage: "novo" };
    await logAiDecision({
      conversationId: conversation.id,
      leadId: lead.id,
      action: "ai_mode_skipped",
      reason: "Mensagem fora da politica de entrada paga. IA nao respondera este lead automaticamente.",
      mode: "human",
      safetyStatus: "skipped",
      metadata: {
        sourcePolicy: "paid_entry_message_only",
        marketing: inbound.marketing,
        leadOrigin: lead.origin
      }
    });
  }

  if (!inbound.fromMe && !conversationState.created && conversation.status !== "ai") {
    leadSignal = { ...leadSignal, pipelineStage: "atendimento" };
    await moveLeadStageIfOpen({
      leadId: lead.id,
      toStage: "atendimento",
      conversationId: conversation.id,
      reason: "Lead respondeu enquanto a conversa nao estava em modo automatico.",
      actor: conversation.status === "human" || conversation.status === "paused" ? "Operador" : "Sistema",
      updates: {
        last_message_preview: inbound.text.slice(0, 280),
        last_interaction_at: new Date()
      }
    });
  }

  if (!inbound.fromMe && conversationState.created && shouldStartAiFlow && !whatsappAiPaused) {
    if (!inbound.marketing?.isAdLead && !isAdsOrigin(lead.origin)) {
      await markLeadAsIntentQualified(lead.id, lead.tags);
    }

    triage = await triageInitialConversation({
      leadName: inbound.leadName,
      messages: [{ role: "lead", content: inbound.text }]
    });
    leadSignal = {
      ...leadSignal,
      temperature: triage.temperature,
      sentiment: triage.sentiment,
      pipelineStage: triage.pipelineStage
    };
    const triageResult = await applyInitialTriage(conversation.id, lead.id, triage);
    conversation = triageResult.conversation;
    await logAiDecision({
      conversationId: conversation.id,
      leadId: lead.id,
      action: "ai_triage_applied",
      reason: triage.reason,
      model: env.OPENAI_MODEL,
      mode: "triage",
      metadata: {
        type: triage.type,
        action: triage.action,
        temperature: triage.temperature,
        sentiment: triage.sentiment,
        pipelineStage: triage.pipelineStage
      }
    });
  } else if (!inbound.fromMe && conversationState.created && (!shouldStartAiFlow || whatsappAiPaused)) {
    const manualQueue = await applyInitialManualQueue(
      conversation.id,
      lead.id,
      inbound,
      whatsappAiPaused
        ? {
          reason: "IA geral do WhatsApp pausada no painel IA Comercial.",
          context: "Politica atual: IA geral do WhatsApp pausada pelo painel IA Comercial.",
          logReason: "Lead novo registrado com IA pausada porque a IA geral do WhatsApp esta pausada no painel IA Comercial."
        }
        : undefined
    );
    conversation = manualQueue.conversation;
    leadSignal = { ...leadSignal, pipelineStage: "novo" };
    await logAiDecision({
      conversationId: conversation.id,
      leadId: lead.id,
      action: "ai_mode_skipped",
      reason: whatsappAiPaused
        ? "IA geral do WhatsApp pausada no painel IA Comercial. Conversa registrada com IA pausada."
        : "Lead novo sem frase inicial de trafego pago. Conversa registrada com IA pausada para triagem humana.",
      mode: "human",
      safetyStatus: "ok",
      metadata: {
        sourcePolicy: whatsappAiPaused ? "global_ai_paused" : "paid_entry_message_only",
        marketing: inbound.marketing
      }
    });
  }

  if (!inbound.fromMe) {
    await resetLeadFollowUpOnCustomerReply(lead.id);
    await moveLeadStage({
      leadId: lead.id,
      toStage: conversation.status === "ai" ? "ia" : "atendimento",
      conversationId: conversation.id,
      reason: conversation.status === "ai"
        ? "Lead respondeu durante follow-up; retorno para atendimento automatico da IA."
        : "Lead respondeu durante follow-up; retorno para atendimento humano.",
      actor: "Sistema",
      allowedFrom: ["followup"],
      updates: {
        last_message_preview: inbound.text.slice(0, 280),
        last_interaction_at: new Date()
      }
    });
    if (conversationState.created && !shouldStartAiFlow) {
      await pauseLeadFollowUp(lead.id);
    }
  }

  const [message] = await db
    .insert(messages)
    .values({
      conversation_id: conversation.id,
      external_message_id: inbound.externalMessageId,
      role: inbound.fromMe ? "human" : "lead",
      content: inbound.text,
      metadata: {
        source: "evolution",
        marketing: inbound.marketing,
        autoStartPolicy: {
          mode: "ads_only",
          eligibleForAi: shouldStartAiFlow
        },
        leadSignal: serializeLeadSignalForMetadata(leadSignal),
        triage,
        messageType: inbound.messageType,
        media: inboundMedia
          ? {
            ...inboundMedia,
            transcription: mediaProcessing.audioTranscription?.text || undefined,
            transcriptionStatus: mediaProcessing.audioTranscription?.status,
            transcriptionReason: mediaProcessing.audioTranscription?.reason,
            description: mediaProcessing.imageDescription?.text || undefined,
            descriptionStatus: mediaProcessing.imageDescription?.status,
            descriptionReason: mediaProcessing.imageDescription?.reason
          }
          : undefined,
        originalContent: mediaProcessing.originalText !== inbound.text ? mediaProcessing.originalText : undefined
      },
      modified_by: SYSTEM_USER_ID
    })
    .onConflictDoNothing({ target: messages.external_message_id })
    .returning();

  if (!message && inbound.externalMessageId) {
    const duplicatedAfterRace = await findDuplicatedEvolutionMessage(inbound.externalMessageId);
    if (duplicatedAfterRace) {
      console.info("[conversation-service] duplicated evolution message ignored after insert race", {
        conversationId: duplicatedAfterRace.conversation.id,
        externalMessageId: inbound.externalMessageId
      });
      return { ...duplicatedAfterRace, duplicated: true };
    }
  }

  if (!message) {
    throw new Error("Nao foi possivel registrar a mensagem recebida.");
  }

  await logInboundMediaProcessingIssues({
    leadId: lead.id,
    conversationId: conversation.id,
    messageId: message.id,
    media: inboundMedia,
    audioTranscription: mediaProcessing.audioTranscription,
    imageDescription: mediaProcessing.imageDescription
  });

  await db
    .update(conversations)
    .set({
      last_message_at: new Date(),
      context_summary: buildContextSummary(inbound.text, leadSignal, triage),
      updated_at: new Date(),
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(conversations.id, conversation.id), eq(conversations.is_deleted, false)));

  await appendRecentConversationContext({
    conversationId: conversation.id,
    messageId: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString()
  });

  if (!inbound.fromMe) {
    await logAiDecision({
      conversationId: conversation.id,
      leadId: lead.id,
      messageId: message.id,
      action: "ai_qualified_lead",
      reason: "Mensagem do lead classificada para atualizar temperatura, sentimento e etapa do funil.",
      mode: conversation.status,
      metadata: {
        temperature: leadSignal.temperature,
        sentiment: leadSignal.sentiment,
        pipelineStage: leadSignal.pipelineStage,
        interest: leadSignal.interest,
        triageType: triage?.type
      }
    });
  }

  if (!inbound.fromMe) {
    const receiptCandidate = isPotentialPixReceipt(inbound);
    const commercialSignal = classifyCommercialSignal(inbound, receiptCandidate);
    let paymentReceipt: Awaited<ReturnType<typeof analyzeAndSavePaymentReceipt>> | null = null;

    if (receiptCandidate) {
      paymentReceipt = await analyzeAndSavePaymentReceipt({
        leadId: lead.id,
        conversationId: conversation.id,
        messageId: message.id,
        inbound
      });
    }

    conversation = await applyCommercialSignal({
      leadId: lead.id,
      leadName: lead.name ?? inbound.leadName,
      leadPhone: lead.phone,
      conversation,
      messageId: message.id,
      signal: commercialSignal,
      lastMessage: inbound.text,
      marketing: inbound.marketing,
      paymentReceipt
    });
  }

  await publishRealtimeEvent({
    type: "message.created",
    conversationId: conversation.id,
    payload: { message }
  });

  if (!inbound.fromMe && conversation.status === "ai" && !whatsappAiPaused) {
    await pushToConversationBuffer({
      conversationId: conversation.id,
      messageId: message.id,
      content: inbound.text,
      receivedAt: new Date().toISOString()
    });
    await scheduleBufferProcessing(conversation.id);
  } else if (!inbound.fromMe && conversation.status === "ai" && whatsappAiPaused) {
    await clearConversationBuffer(conversation.id);
    await logAiDecision({
      conversationId: conversation.id,
      leadId: lead.id,
      messageId: message.id,
      action: "ai_reply_skipped_global_pause",
      reason: "Mensagem nao entrou no buffer porque a IA geral do WhatsApp esta pausada.",
      mode: "paused",
      safetyStatus: "skipped",
      metadata: { sourcePolicy: "global_ai_paused" }
    });
  }

  return { lead, conversation, message, duplicated: false };
}

async function logInboundMediaProcessingIssues(input: {
  leadId: string;
  conversationId: string;
  messageId: string;
  media?: NormalizedInboundMessage["media"] & {
    storageStatus?: string;
    storageError?: string;
  };
  audioTranscription?: AudioTranscriptionResult;
  imageDescription?: ImageDescriptionResult;
}) {
  if (!input.media) return;

  const events: Array<{ event: string; message: string; metadata: Record<string, unknown> }> = [];
  if (input.media.storageStatus && input.media.storageStatus !== "stored") {
    events.push({
      event: "media_storage_unavailable",
      message: "Midia recebida registrada, mas o arquivo nao foi armazenado no MinIO.",
      metadata: {
        mediaType: input.media.type,
        storageStatus: input.media.storageStatus,
        storageError: input.media.storageError
      }
    });
  }

  if (input.audioTranscription && input.audioTranscription.status !== "transcribed") {
    events.push({
      event: "audio_transcription_unavailable",
      message: "Audio recebido registrado, mas a transcricao automatica nao ficou disponivel.",
      metadata: {
        transcriptionStatus: input.audioTranscription.status,
        transcriptionReason: input.audioTranscription.reason
      }
    });
  }

  if (input.imageDescription && input.imageDescription.status !== "described") {
    events.push({
      event: "image_description_unavailable",
      message: "Imagem recebida registrada, mas a descricao automatica nao ficou disponivel.",
      metadata: {
        descriptionStatus: input.imageDescription.status,
        descriptionReason: input.imageDescription.reason
      }
    });
  }

  await Promise.all(events.map((event) => logSystemEvent({
    source: "media-processing",
    event: event.event,
    severity: "warning",
    message: event.message,
    leadId: input.leadId,
    conversationId: input.conversationId,
    metadata: {
      ...event.metadata,
      messageId: input.messageId
    }
  })));
}

async function processInboundMedia(input: NormalizedInboundMessage): Promise<{
  originalText: string;
  textForAi?: string;
  audioTranscription?: AudioTranscriptionResult;
  imageDescription?: ImageDescriptionResult;
  media?: InboundMediaProcessingResult;
}> {
  if (input.fromMe || !input.media) {
    return { originalText: input.text };
  }

  const media: InboundMediaProcessingResult = await processAndStoreInboundMedia(input.media, {
    remoteJid: input.externalChatId,
    messageId: input.externalMessageId,
    fromMe: input.fromMe
  }).catch((error): InboundMediaProcessingResult => ({
    media: {
      ...input.media!,
      storageStatus: "error" as const,
      storageError: error instanceof Error ? error.message : "Falha ao processar midia recebida."
    }
  }));

  if (input.media.type === "audio") {
    const transcriptionInput = media.buffer
      ? {
        ...input.media,
        mimeType: media.media.mimeType ?? input.media.mimeType,
        base64: media.buffer.toString("base64")
      }
      : input.media;
    const audioTranscription = await transcribeInboundAudio(transcriptionInput, {
      remoteJid: input.externalChatId,
      messageId: input.externalMessageId,
      fromMe: input.fromMe
    });
    if (audioTranscription.status === "transcribed") {
      return {
        originalText: input.text,
        textForAi: `Audio transcrito do cliente: ${audioTranscription.text}`,
        audioTranscription,
        media
      };
    }

    return {
      originalText: input.text,
      textForAi: [
        "Cliente enviou um audio, mas nao foi possivel transcrever automaticamente.",
        "Nao invente o conteudo do audio.",
        "Peca para o cliente enviar a informacao por texto ou acione atendimento humano se for necessario."
      ].join(" "),
      audioTranscription,
      media
    };
  }

  if (input.media.type === "image") {
    const imageDescription = await describeInboundImage({
      dataUrl: media.media.dataUrl,
      caption: input.media.caption,
      messageId: input.externalMessageId
    });
    if (imageDescription.status === "described") {
      return {
        originalText: input.text,
        textForAi: input.media.caption
          ? `${input.media.caption}\nImagem recebida: ${imageDescription.text}`
          : `Imagem recebida: ${imageDescription.text}`,
        imageDescription,
        media
      };
    }

    return {
      originalText: input.text,
      imageDescription,
      media
    };
  }

  return { originalText: input.text, media };
}

async function ensureSystemUser() {
  await db
    .insert(users)
    .values({
      id: SYSTEM_USER_ID,
      name: "Auto Pro IA",
      email: "sistema@autoproia.local",
      role: "admin",
      modified_by: SYSTEM_USER_ID
    })
    .onConflictDoNothing();
}

async function applyCommercialSignal(input: {
  leadId: string;
  leadName?: string | null;
  leadPhone: string;
  conversation: typeof conversations.$inferSelect;
  messageId: string;
  signal: CommercialSignal;
  lastMessage: string;
  marketing?: NormalizedInboundMessage["marketing"];
  paymentReceipt?: Awaited<ReturnType<typeof analyzeAndSavePaymentReceipt>> | null;
}) {
  const now = new Date();
  const shouldMoveToHuman =
    input.signal.status === "aguardando_validacao_pagamento"
    || input.signal.status === "atendimento_humano_necessario";

  if (input.signal.pipelineStage) {
    await moveLeadStage({
      leadId: input.leadId,
      toStage: input.signal.pipelineStage,
      conversationId: input.conversation.id,
      messageId: input.messageId,
      reason: input.signal.reason,
      actor: "IA",
      updates: {
        commercial_status: input.signal.status,
        temperature: input.signal.temperature,
        last_message_preview: input.lastMessage.slice(0, 280),
        last_interaction_at: now,
        enrollment_closed_at: input.signal.status === "venda" ? now : undefined
      }
    });
  } else {
    await db
      .update(leads)
      .set({
        commercial_status: input.signal.status,
        temperature: input.signal.temperature ?? undefined,
        last_message_preview: input.lastMessage.slice(0, 280),
        last_interaction_at: now,
        updated_at: now,
        modified_by: SYSTEM_USER_ID
      })
      .where(and(eq(leads.id, input.leadId), eq(leads.is_deleted, false)));
  }

  let conversation = input.conversation;

  if (shouldMoveToHuman) {
    const [updated] = await db
      .update(conversations)
      .set({
        status: "human",
        ai_paused_reason: input.signal.reason,
        context_summary: [
          input.conversation.context_summary,
          `Status comercial: ${input.signal.status}. ${input.signal.reason}`
        ].filter(Boolean).join(" "),
        updated_at: now,
        modified_by: SYSTEM_USER_ID
      })
      .where(and(eq(conversations.id, input.conversation.id), eq(conversations.is_deleted, false)))
      .returning();

    if (updated) conversation = updated;
    await clearConversationBuffer(input.conversation.id);
    await pauseLeadFollowUp(input.leadId);
  }

  if (input.signal.shouldNotify) {
    await createCrmNotification({
      leadId: input.leadId,
      conversationId: input.conversation.id,
      messageId: input.messageId,
      type: input.signal.notificationType ?? "human_required",
      title: getCommercialNotificationTitle(input.signal.status),
      body: [
        input.leadName || "Lead sem nome",
        input.leadPhone,
        input.marketing?.origin ? `Origem: ${input.marketing.origin}` : null,
        `Status: ${input.signal.status}`,
        `Ultima mensagem: ${input.lastMessage.slice(0, 180)}`
      ].filter(Boolean).join(" | "),
      payload: {
        origin: input.marketing?.origin,
        marketing: input.marketing,
        reason: input.signal.reason,
        lastMessage: input.lastMessage,
        conversationUrl: `/conversas?conversationId=${input.conversation.id}`,
        paymentReceipt: input.paymentReceipt
          ? {
            id: input.paymentReceipt.receipt.id,
            fileUrl: input.paymentReceipt.receipt.file_url,
            amountText: input.paymentReceipt.receipt.amount_text,
            paidAtText: input.paymentReceipt.receipt.paid_at_text,
            payerName: input.paymentReceipt.receipt.payer_name,
            receiverName: input.paymentReceipt.receipt.receiver_name,
            transactionId: input.paymentReceipt.receipt.transaction_id,
            detected: input.paymentReceipt.receipt.detected
          }
          : undefined
      }
    });
  }

  if (input.signal.status === "aguardando_validacao_pagamento") {
    await sendPaymentReceiptAck({
      leadId: input.leadId,
      conversationId: input.conversation.id,
      phone: input.leadPhone,
      sourceMessageId: input.messageId
    });
  }

  await logAiDecision({
    conversationId: input.conversation.id,
    leadId: input.leadId,
    messageId: input.messageId,
    action: input.signal.status === "atendimento_humano_necessario" ? "human_handoff_triggered" : "ai_qualified_lead",
    reason: input.signal.reason,
    mode: conversation.status,
    safetyStatus: "ok",
    metadata: {
      commercialStatus: input.signal.status,
      pipelineStage: input.signal.pipelineStage,
      notificationType: input.signal.notificationType,
      paymentReceiptId: input.paymentReceipt?.receipt.id
    }
  });

  return conversation;
}

async function sendPaymentReceiptAck(input: {
  leadId: string;
  conversationId: string;
  phone: string;
  sourceMessageId: string;
}) {
  const text = "Recebi seu comprovante e encaminhei para conferencia. Ja vamos validar para dar continuidade.";

  try {
    const evolutionResults = normalizeEvolutionSendResults(await sendWhatsAppText({ phone: input.phone, text }));
    const [aiMessage] = await db
      .insert(messages)
      .values({
        conversation_id: input.conversationId,
        external_message_id: evolutionResults[0]?.messageId,
        role: "ai",
        content: text,
        metadata: {
          source: "payment_receipt_ack",
          sourceMessageId: input.sourceMessageId,
          evolutionMessageKeys: evolutionResults.map((result) => result.key).filter(Boolean)
        },
        modified_by: SYSTEM_USER_ID
      })
      .returning();

    await appendRecentConversationContext({
      conversationId: input.conversationId,
      messageId: aiMessage.id,
      role: aiMessage.role,
      content: aiMessage.content,
      createdAt: new Date().toISOString()
    });

    await publishRealtimeEvent({
      type: "message.created",
      conversationId: input.conversationId,
      payload: { message: aiMessage }
    });
  } catch (error) {
    console.warn("[conversation-service] failed to send payment receipt acknowledgement", error);
  }
}

function getCommercialNotificationTitle(status: string) {
  const titles: Record<string, string> = {
    aguardando_validacao_pagamento: "Comprovante PIX recebido",
    aguardando_comprovante: "Lead com intencao de compra",
    atendimento_humano_necessario: "Atendimento humano necessario"
  };

  return titles[status] ?? "Atualizacao comercial do lead";
}

export async function processBufferedConversation(conversationId: string) {
  console.info("[conversation-service] processing buffer started", { conversationId });

  if (await isWhatsAppAiPaused()) {
    await clearConversationBuffer(conversationId);
    await logAiDecision({
      conversationId,
      action: "ai_reply_skipped_global_pause",
      reason: "A IA nao respondeu porque a IA geral do WhatsApp esta pausada no painel IA Comercial.",
      mode: "paused",
      safetyStatus: "skipped",
      metadata: { sourcePolicy: "global_ai_paused" }
    });
    console.info("[conversation-service] processing skipped by global whatsapp ai pause", { conversationId });
    return { skipped: true };
  }

  if (!(await shouldProcessBuffer(conversationId))) {
    console.info("[conversation-service] processing skipped without pending buffer", { conversationId });
    return { skipped: true };
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .limit(1);

  if (!conversation || conversation.status !== "ai") {
    if (conversation && conversation.status !== "ai") {
      await clearConversationBuffer(conversationId);
      await logAiDecision({
        conversationId,
        leadId: conversation.lead_id,
        action: "ai_reply_skipped_manual_mode",
        reason: "A IA nao respondeu porque a conversa nao estava em modo automatico.",
        mode: conversation.status,
        safetyStatus: "skipped",
        metadata: { status: conversation.status }
      });
    }
    console.info("[conversation-service] processing skipped by conversation status", {
      conversationId,
      status: conversation?.status
    });
    return { skipped: true };
  }

  const buffered = await drainConversationBuffer(conversationId);
  if (buffered.length === 0) {
    console.info("[conversation-service] processing skipped empty buffer", { conversationId });
    return { skipped: true };
  }

  console.info("[conversation-service] buffered messages grouped for ai reply", {
    conversationId,
    count: buffered.length,
    messageIds: buffered.map((item) => item.messageId)
  });

  const recentMessages = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversation_id, conversationId), eq(messages.is_deleted, false)))
    .orderBy(desc(messages.created_at))
    .limit(20);

  const redisContext = await getRecentConversationContext(conversationId);
  const messagesForContext = redisContext.length > 0
    ? redisContext.map((message) => ({ role: message.role, content: message.content }))
    : recentMessages.reverse().map((message) => ({
      role: message.role,
      content: message.content
    }));

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, conversation.lead_id), eq(leads.is_deleted, false)))
    .limit(1);

  if (!lead) {
    throw new Error("Lead da conversa nao encontrado.");
  }

  if (!isAiAllowedLead(lead.origin, lead.tags)) {
    await clearConversationBuffer(conversationId);
    await db
      .update(conversations)
      .set({
        status: "human",
        ai_paused_reason: "Politica de ativacao: lead sem origem de anuncio e sem primeira mensagem qualificada.",
        updated_at: new Date(),
        modified_by: SYSTEM_USER_ID
      })
      .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)));
    await logAiDecision({
      conversationId,
      leadId: lead.id,
      action: "ai_mode_skipped",
      reason: "A IA nao respondeu porque o lead nao tem origem de anuncio validada nem primeira mensagem qualificada.",
      mode: "human",
      safetyStatus: "skipped",
      metadata: {
        sourcePolicy: "ads_or_new_enrollment_intent",
        leadOrigin: lead.origin,
        leadTags: lead.tags,
        bufferedMessageIds: buffered.map((item) => item.messageId)
      }
    });
    console.info("[conversation-service] ai reply skipped by ads-only source policy", {
      conversationId,
      leadId: lead.id,
      origin: lead.origin
    });
    return { skipped: true };
  }

  console.info("[conversation-service] generating ai reply", {
    conversationId,
    leadId: lead.id,
    bufferedMessages: buffered.length
  });

  const reply = await generateAiReply({
    leadName: lead?.name,
    contextSummary: conversation.context_summary,
    messages: messagesForContext
  });
  const cleanReply = sanitizeWhatsAppText(reply.text);

  if (reply.safety.status === "blocked") {
    await logAiDecision({
      conversationId,
      leadId: lead.id,
      action: "ai_reply_blocked_by_safety",
      reason: reply.safety.reason,
      model: env.OPENAI_MODEL,
      mode: "ai",
      safetyStatus: "blocked",
      metadata: {
        blockedValues: reply.safety.blockedValues,
        bufferedMessageIds: buffered.map((item) => item.messageId)
      }
    });
  }

  const [currentBeforeSend] = await db
    .select({ status: conversations.status })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .limit(1);

  if (!currentBeforeSend || currentBeforeSend.status !== "ai") {
    console.info("[conversation-service] ai reply discarded because conversation left automatic mode", {
      conversationId,
      status: currentBeforeSend?.status
    });
    await logAiDecision({
      conversationId,
      leadId: lead.id,
      action: "ai_reply_skipped_manual_mode",
      reason: "Resposta gerada foi descartada porque a conversa saiu do modo automatico antes do envio.",
      model: env.OPENAI_MODEL,
      mode: currentBeforeSend?.status ?? null,
      safetyStatus: "skipped",
      metadata: { status: currentBeforeSend?.status }
    });
    return { skipped: true };
  }

  console.info("[conversation-service] sending whatsapp reply", { conversationId, phone: lead.phone });
  const evolutionResults = normalizeEvolutionSendResults(await sendWhatsAppText({ phone: lead.phone, text: cleanReply }));
  console.info("[conversation-service] whatsapp reply sent", { conversationId });

  const [aiMessage] = await db
    .insert(messages)
    .values({
      conversation_id: conversationId,
      external_message_id: evolutionResults[0]?.messageId,
      role: "ai",
      content: cleanReply,
      metadata: {
        source: "openai",
        bufferedMessageIds: buffered.map((item) => item.messageId),
        evolutionMessageKeys: evolutionResults.map((result) => result.key).filter(Boolean)
      },
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  await logAiDecision({
    conversationId,
    leadId: lead.id,
    messageId: aiMessage.id,
    action: "ai_reply_generated",
    reason: reply.safety.status === "blocked"
      ? "Resposta segura enviada apos bloqueio de informacao comercial nao cadastrada."
      : "Conversa estava em modo automatico e a resposta foi validada contra as regras comerciais.",
    model: env.OPENAI_MODEL,
    mode: "ai",
    safetyStatus: reply.safety.status === "blocked" ? "fallback" : "ok",
    metadata: {
      bufferedMessageIds: buffered.map((item) => item.messageId),
      safety: reply.safety
    }
  });

  await db
    .update(conversations)
    .set({
      last_message_at: new Date(),
      updated_at: new Date(),
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)));

  await publishRealtimeEvent({
    type: "message.created",
    conversationId,
    payload: { message: aiMessage }
  });

  await appendRecentConversationContext({
    conversationId,
    messageId: aiMessage.id,
    role: aiMessage.role,
    content: cleanReply,
    createdAt: new Date().toISOString()
  });

  await scheduleLeadFollowUp(lead.id);

  return { skipped: false, message: aiMessage };
}

export async function assumeConversation(conversationId: string, userId: string, reason?: string) {
  return changeConversationStatus(conversationId, userId, "human", reason);
}

export async function returnConversationToAi(conversationId: string, userId: string, reason?: string) {
  return changeConversationStatus(conversationId, userId, "ai", reason);
}

async function changeConversationStatus(
  conversationId: string,
  userId: string,
  toStatus: "ai" | "human",
  reason?: string
) {
  const [current] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .limit(1);

  if (!current) {
    throw new Error("Conversa nao encontrada.");
  }

  const [updated] = await db
    .update(conversations)
    .set({
      status: toStatus,
      assigned_to: toStatus === "human" ? userId : null,
      ai_paused_reason: toStatus === "human" ? reason ?? "Atendente assumiu a conversa." : null,
      updated_at: new Date(),
      modified_by: userId
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .returning();

  if (!updated) {
    throw new Error("Nao foi possivel atualizar o status da conversa.");
  }

  if (toStatus === "human" || toStatus === "ai") {
    if (toStatus === "human") {
      try {
        await clearConversationBuffer(conversationId);
      } catch (error) {
        console.warn("[conversation-service] failed to clear buffer after human handoff", error);
      }
      try {
        await pauseLeadFollowUp(current.lead_id, userId);
      } catch (error) {
        console.warn("[conversation-service] failed to pause follow-up after handoff", error);
      }
    } else {
      try {
        await resumeLeadFollowUp(current.lead_id, userId);
      } catch (error) {
        console.warn("[conversation-service] failed to resume follow-up after return to ai", error);
      }
    }

    await moveLeadStageIfOpen({
      leadId: current.lead_id,
      toStage: toStatus === "human" ? "atendimento" : "ia",
      conversationId,
      reason: reason ?? (toStatus === "human" ? "IA pausada ou conversa assumida por operador." : "Conversa devolvida para atendimento automatico da IA."),
      actor: "Operador",
      modifiedBy: userId,
      updates: {
        last_interaction_at: new Date()
      }
    });
  }

  try {
    await db.insert(handoffEvents).values({
      conversation_id: conversationId,
      from_status: current.status,
      to_status: toStatus,
      reason,
      modified_by: userId
    });
  } catch (error) {
    console.warn("[conversation-service] failed to write handoff event", error);
  }

  try {
    await logAiDecision({
      conversationId,
      leadId: current.lead_id,
      action: toStatus === "human" ? "human_handoff_triggered" : "ai_mode_restored",
      reason: reason ?? (toStatus === "human" ? "Atendente assumiu a conversa manualmente." : "Atendente devolveu a conversa para a IA."),
      mode: toStatus,
      safetyStatus: "ok",
      metadata: {
        fromStatus: current.status,
        toStatus
      },
      modifiedBy: userId
    });
  } catch (error) {
    console.warn("[conversation-service] failed to log handoff decision", error);
  }

  try {
    await publishRealtimeEvent({
      type: "handoff.changed",
      conversationId,
      payload: { conversation: updated }
    });
  } catch (error) {
    console.warn("[conversation-service] failed to publish handoff event", error);
  }

  return updated;
}

async function findDuplicatedEvolutionMessage(externalMessageId?: string) {
  if (!externalMessageId) return null;

  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.external_message_id, externalMessageId), eq(messages.is_deleted, false)))
    .limit(1);

  if (!message) return null;

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, message.conversation_id), eq(conversations.is_deleted, false)))
    .limit(1);

  if (!conversation) return null;

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, conversation.lead_id), eq(leads.is_deleted, false)))
    .limit(1);

  if (!lead) return null;

  return { lead, conversation, message };
}

type LeadSignal = {
  temperature: "urgente" | "quente" | "morno" | "frio";
  sentiment: "positivo" | "neutro" | "duvida" | "negativo";
  pipelineStage: FunnelStage;
  commercialStatus?: string;
  interest?: string;
  enrollmentClosedAt?: Date;
};

async function upsertLead(input: NormalizedInboundMessage, signal: LeadSignal) {
  const now = new Date();
  const name = getCustomerLeadName(input);
  const payloadAvatarUrl = !input.fromMe ? input.avatarUrl : undefined;
  const avatarUrl = payloadAvatarUrl ?? await fetchWhatsAppProfilePicture(input.phone);
  const origin = input.marketing?.origin ?? "WhatsApp";
  const tags = input.marketing?.isAdLead ? ["anuncio", input.marketing.platform ?? "meta"].filter(Boolean) : undefined;

  const [existing] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.phone, input.phone), eq(leads.is_deleted, false)))
    .limit(1);

  if (existing) {
    const existingStage = normalizeLeadPipelineStage(existing.pipeline_stage);
    const nextPipelineStage = shouldPreserveExistingStage(existingStage, signal.pipelineStage)
      ? existingStage
      : signal.pipelineStage;
    const [updated] = await db
      .update(leads)
      .set({
        name: shouldReplaceLeadName(existing.name, name, input.phone) ? name : existing.name,
        avatar_url: shouldReplaceLeadAvatar(existing.avatar_url, avatarUrl) ? avatarUrl : existing.avatar_url,
        origin: input.marketing?.isAdLead ? origin : existing.origin,
        tags: tags ?? existing.tags,
        interest: signal.interest ?? existing.interest,
        temperature: signal.temperature,
        sentiment: signal.sentiment,
        commercial_status: signal.commercialStatus ?? existing.commercial_status ?? "em_atendimento",
        pipeline_stage: nextPipelineStage,
        last_message_preview: input.text.slice(0, 280),
        last_interaction_at: now,
        enrollment_closed_at: signal.enrollmentClosedAt ?? existing.enrollment_closed_at,
        updated_at: now,
        modified_by: SYSTEM_USER_ID
      })
      .where(and(eq(leads.id, existing.id), eq(leads.is_deleted, false)))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(leads)
    .values({
      name: name ?? input.phone,
      phone: input.phone,
      avatar_url: avatarUrl,
      origin,
      interest: signal.interest,
      temperature: signal.temperature,
      sentiment: signal.sentiment,
      commercial_status: signal.commercialStatus ?? "em_atendimento",
      pipeline_stage: signal.pipelineStage,
      last_message_preview: input.text.slice(0, 280),
      last_interaction_at: now,
      enrollment_closed_at: signal.enrollmentClosedAt,
      tags: tags ?? [],
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  return created;
}

function getCustomerLeadName(input: NormalizedInboundMessage) {
  if (input.fromMe) return undefined;

  const name = input.leadName?.trim();
  if (!name || isLikelyBusinessProfileName(name)) return undefined;

  return name;
}

function shouldReplaceLeadName(currentName: string | null | undefined, nextName: string | undefined, phone: string) {
  if (!nextName) return false;

  const current = currentName?.trim();
  if (!current) return true;
  if (current === phone) return true;
  if (current.replace(/\D/g, "") === phone.replace(/\D/g, "")) return true;
  if (isLikelyBusinessProfileName(current)) return true;

  return false;
}

function shouldReplaceLeadAvatar(currentAvatar: string | null | undefined, nextAvatar: string | null | undefined) {
  if (!nextAvatar) return false;
  if (!currentAvatar) return true;
  return isLikelyBusinessAvatarUrl(currentAvatar);
}

function isLikelyBusinessProfileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const businessNames = [
    "auto escola catuense",
    "autoescola catuense",
    "cfc catuense",
    "auto pro ia",
    "auto pro ia crm"
  ];

  return businessNames.includes(normalized);
}

function isLikelyBusinessAvatarUrl(url: string) {
  const normalized = url.toLowerCase();
  return normalized.includes("autoescola") || normalized.includes("catuense") || normalized.includes("autopro");
}

function classifyLeadSignal(text: string): LeadSignal {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const hasAny = (terms: string[]) => terms.some((term) => normalized.includes(term));
  const isClosed = hasAny(["matricula fechada", "matricula realizada", "matricula concluida", "contrato assinado"]);
  const wantsEnroll = hasAny(["quero matricular", "fechar matricula", "posso matricular", "vou fechar", "enviar contrato", "paguei", "pagamento feito", "comprovante"]);
  const urgent = hasAny(["urgente", "hoje", "agora", "preciso comecar", "preciso tirar", "quanto antes"]);
  const hot = wantsEnroll || hasAny(["valor", "preco", "parcel", "desconto", "pix", "cartao", "proposta"]);
  const cold = hasAny(["vou pensar", "depois", "sem interesse", "nao quero", "muito caro"]);
  const negative = hasAny(["reclamar", "problema", "ruim", "demora", "cancelar", "nao gostei"]);
  const positive = isClosed || wantsEnroll || hasAny(["obrigado", "gostei", "perfeito", "otimo", "beleza"]);

  const interest = hasAny(["moto"]) ? "moto" : hasAny(["adicao", "adicionar"]) ? "adicao" : hasAny(["mudanca"]) ? "mudanca" : hasAny(["carro", "cnh b", "categoria b"]) ? "carro" : undefined;

  return {
    temperature: urgent ? "urgente" : hot ? "quente" : cold ? "frio" : "morno",
    sentiment: negative ? "negativo" : positive ? "positivo" : hasAny(["duvida", "como", "quando", "qual", "tem aula"]) ? "duvida" : "neutro",
    pipelineStage: isClosed ? "fechado" : wantsEnroll ? "matricula_pendente" : hot ? "atendimento" : cold ? "followup" : "ia",
    interest,
    enrollmentClosedAt: isClosed ? new Date() : undefined
  };
}

function normalizeLeadPipelineStage(value: string | null | undefined): FunnelStage {
  if (value === "matricula_realizada") return "fechado";
  if (value === "novo" || value === "ia" || value === "atendimento" || value === "followup" || value === "matricula_pendente" || value === "fechado" || value === "perdido") {
    return value;
  }
  return "novo";
}

function shouldPreserveExistingStage(existingStage: FunnelStage, incomingStage: FunnelStage) {
  if (existingStage === "fechado" || existingStage === "perdido") return true;
  if (existingStage === "matricula_pendente" && incomingStage !== "fechado") return true;
  if (existingStage === "followup") return true;
  return false;
}

function buildContextSummary(text: string, signal: LeadSignal, triage?: AiTriageResult | null) {
  return [
    triage ? `Triagem inicial: ${triage.type}; acao: ${triage.action}; motivo: ${triage.reason}.` : "",
    `Temperatura: ${signal.temperature}.`,
    `Sentimento: ${signal.sentiment}.`,
    `Etapa: ${signal.pipelineStage}.`,
    signal.interest ? `Interesse: ${signal.interest}.` : "",
    `Ultima mensagem: ${text.slice(0, 180)}`
  ].filter(Boolean).join(" ");
}

function isAiEligibleInbound(input: NormalizedInboundMessage, leadOrigin?: string | null, isNewConversation = false) {
  if (input.fromMe) return false;
  if (!isNewConversation) return Boolean(input.marketing?.isAdLead || isAdsOrigin(leadOrigin));
  return isPaidTrafficEntryMessage(input.text);
}

function isAdsOrigin(origin?: string | null) {
  const normalized = (origin ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return (
    normalized.includes("meta ads")
    || normalized.includes("facebook ads")
    || normalized.includes("instagram ads")
    || normalized.includes("anuncio")
    || normalized.includes("ads")
  );
}

function isAiAllowedLead(origin?: string | null, tags?: unknown) {
  if (isAdsOrigin(origin)) return true;
  return Array.isArray(tags) && tags.includes("intencao_matricula");
}

function hasClearEnrollmentIntent(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  const patterns = [
    "tenho interesse",
    "quero saber o valor",
    "qual o valor da cnh",
    "quanto custa para tirar habilitacao",
    "quanto custa tirar habilitacao",
    "quanto custa a habilitacao",
    "quero fazer minha matricula",
    "quero tirar minha carteira",
    "tenho interesse na habilitacao",
    "valor da habilitacao",
    "valor da cnh",
    "preco da habilitacao",
    "preco da cnh",
    "tirar cnh",
    "tirar minha cnh",
    "primeira habilitacao",
    "categoria a",
    "categoria b",
    "categoria ab"
  ];

  return patterns.some((pattern) => normalized.includes(pattern));
}

function isPaidTrafficEntryMessage(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const acceptedMessages = [
    "tenho interesse gostaria de mais informacoes",
    "tenho interesse gostaria de mais informacoes por favor",
    "ola tenho interesse gostaria de mais informacoes",
    "ola tenho interesse gostaria de mais informacoes por favor",
    "tenho interesse e gostaria de mais informacoes",
    "tenho interesse e gostaria de mais informacoes por favor",
    "ola tenho interesse e gostaria de mais informacoes",
    "ola tenho interesse e gostaria de mais informacoes por favor",
    "tenho interesse e queria mais informacoes",
    "tenho interesse e queria mais informacoes por favor",
    "ola tenho interesse e queria mais informacoes",
    "ola tenho interesse e queria mais informacoes por favor"
  ];

  return acceptedMessages.includes(normalized);
}

async function markLeadAsIntentQualified(leadId: string, currentTags?: unknown) {
  const tags = Array.isArray(currentTags) ? currentTags.filter((tag): tag is string => typeof tag === "string") : [];
  if (!tags.includes("intencao_matricula")) tags.push("intencao_matricula");

  await db
    .update(leads)
    .set({
      tags,
      updated_at: new Date(),
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(leads.id, leadId), eq(leads.is_deleted, false)));
}

function serializeLeadSignalForMetadata(signal: LeadSignal) {
  return {
    ...signal,
    enrollmentClosedAt: signal.enrollmentClosedAt?.toISOString()
  };
}

async function applyInitialTriage(conversationId: string, leadId: string, triage: AiTriageResult) {
  const toStatus = triage.action === "pause_ai" ? "human" : "ai";
  const now = new Date();

  const [conversation] = await db
    .update(conversations)
    .set({
      status: toStatus,
      assigned_to: null,
      ai_paused_reason: triage.action === "pause_ai" ? `Triagem: ${triage.reason}` : null,
      context_summary: `Triagem: ${triage.type}. Acao: ${triage.action}. Motivo: ${triage.reason}`,
      last_message_at: now,
      updated_at: now,
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .returning();

  await moveLeadStage({
    leadId,
    toStage: triage.pipelineStage,
    conversationId,
    reason: triage.action === "pause_ai"
      ? `Triagem pausou a IA: ${triage.reason}`
      : `Lead vindo de campanha/gatilho automatico entrou em IA Atendendo: ${triage.reason}`,
    actor: "IA",
    updates: {
      temperature: triage.temperature,
      sentiment: triage.sentiment,
      last_interaction_at: now
    }
  });

  if (triage.action === "pause_ai") {
    await pauseLeadFollowUp(leadId);
    await clearConversationBuffer(conversationId);
  }

  if (!conversation) {
    const [current] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
      .limit(1);

    if (!current) {
      throw new Error("Conversa nao encontrada apos triagem.");
    }

    return { conversation: current };
  }

  console.info("[conversation-service] initial triage applied", {
    conversationId,
    leadId,
    action: triage.action,
    type: triage.type
  });

  return { conversation };
}

async function applyInitialManualQueue(
  conversationId: string,
  leadId: string,
  input: NormalizedInboundMessage,
  options?: {
    reason: string;
    context: string;
    logReason: string;
  }
) {
  const now = new Date();
  const pausedReason = options?.reason ?? "Lead novo sem origem de anuncio. IA pausada pela politica inicial ads_only.";

  const [conversation] = await db
    .update(conversations)
    .set({
      status: "human",
      assigned_to: null,
      ai_paused_reason: pausedReason,
      context_summary: [
        "Entrada registrada sem sinal de anuncio.",
        options?.context ?? "Politica atual: somente leads de anuncios entram no fluxo automatico da IA.",
        `Origem detectada: ${input.marketing?.origin ?? "WhatsApp"}.`
      ].join(" "),
      last_message_at: now,
      updated_at: now,
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .returning();

  await moveLeadStage({
    leadId,
    toStage: "novo",
    conversationId,
    reason: options?.logReason ?? "Lead novo sem origem de anuncio entrou fora do fluxo automatico da IA.",
    actor: "Sistema",
    updates: {
      last_interaction_at: now
    }
  });

  await pauseLeadFollowUp(leadId);
  await clearConversationBuffer(conversationId);

  if (!conversation) {
    const [current] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
      .limit(1);

    if (!current) {
      throw new Error("Conversa nao encontrada apos pausa inicial.");
    }

    return { conversation: current };
  }

  console.info("[conversation-service] non-ad lead routed to human queue", {
    conversationId,
    leadId,
    origin: input.marketing?.origin
  });

  return { conversation };
}

async function applyWhatsAppHumanControl(
  conversationId: string,
  leadId: string,
  input: NormalizedInboundMessage
) {
  const now = new Date();
  const reason = "Mensagem enviada pelo WhatsApp oficial. Atendimento humano assumiu a conversa.";

  const [conversation] = await db
    .update(conversations)
    .set({
      status: "human",
      assigned_to: null,
      ai_paused_reason: reason,
      last_message_at: now,
      updated_at: now,
      modified_by: SYSTEM_USER_ID
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
    .returning();

  await clearConversationBuffer(conversationId);
  await pauseLeadFollowUp(leadId);
  await moveLeadStageIfOpen({
    leadId,
    toStage: "atendimento",
    conversationId,
    reason,
    actor: "Operador",
    updates: {
      last_message_preview: input.text.slice(0, 280),
      last_interaction_at: now
    }
  });

  await logAiDecision({
    conversationId,
    leadId,
    action: "ai_reply_skipped_manual_mode",
    reason: "A IA foi pausada porque uma mensagem fromMe=true indicou atendimento humano pelo WhatsApp oficial.",
    mode: "human",
    safetyStatus: "skipped",
    metadata: {
      fromMe: input.fromMe,
      externalMessageId: input.externalMessageId,
      messageType: input.messageType
    }
  });

  if (!conversation) {
    const [current] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.is_deleted, false)))
      .limit(1);

    if (!current) {
      throw new Error("Conversa nao encontrada apos assumir atendimento humano pelo WhatsApp.");
    }

    return { conversation: current };
  }

  console.info("[conversation-service] whatsapp fromMe routed to human mode", {
    conversationId,
    leadId,
    externalMessageId: input.externalMessageId
  });

  return { conversation };
}

async function upsertConversation(leadId: string, externalChatId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.external_chat_id, externalChatId), eq(conversations.is_deleted, false)))
    .limit(1);

  if (existing) {
    return { conversation: existing, created: false };
  }

  const [created] = await db
    .insert(conversations)
    .values({
      lead_id: leadId,
      external_chat_id: externalChatId,
      status: "ai",
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  return { conversation: created, created: true };
}
