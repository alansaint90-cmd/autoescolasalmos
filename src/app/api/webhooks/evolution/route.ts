import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processBufferedConversation, registerInboundMessage } from "@/lib/services/conversation-service";
import { triggerDueFollowUpsInBackground } from "@/lib/services/follow-up-service";
import { getMessageBufferWindowMs } from "@/lib/services/message-buffer";
import { logSystemEvent } from "@/lib/services/system-event-log-service";
import { evolutionWebhookSchema } from "@/lib/validators/evolution";
import { getIgnorableChatReason, normalizeEvolutionMessage } from "@/lib/whatsapp/normalizer";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/evolution",
    message: "Webhook Evolution ativo. Configure esta URL na Evolution usando POST."
  });
}

export async function POST(request: NextRequest) {
  if (env.EVOLUTION_WEBHOOK_SECRET) {
    const secret = getWebhookSecret(request);
    if (secret !== env.EVOLUTION_WEBHOOK_SECRET) {
      console.warn("[evolution-webhook] unauthorized webhook request");
      void logSystemEvent({
        source: "evolution-webhook",
        event: "unauthorized_request",
        severity: "warning",
        message: "Webhook recusado por segredo invalido.",
        metadata: { hasAuthorization: Boolean(request.headers.get("authorization")) }
      });
      return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    void logSystemEvent({
      source: "evolution-webhook",
      event: "invalid_json",
      severity: "warning",
      message: "Webhook recebeu JSON invalido ou vazio."
    });
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }
  console.info("[evolution-webhook] payload received", {
    event: body?.event,
    instance: body?.instance,
    messageType: body?.data?.messageType,
    fromMe: body?.data?.key?.fromMe
  });

  if (body?.event !== "messages.upsert") {
    console.info("[evolution-webhook] ignored non inbound-message event", {
      event: body?.event,
      instance: body?.instance
    });
    void logSystemEvent({
      source: "evolution-webhook",
      event: "ignored_event",
      severity: "info",
      message: `Evento ignorado: ${body?.event ?? "sem evento"}.`,
      metadata: { event: body?.event, instance: body?.instance }
    });
    return NextResponse.json({ ignored: true, event: body?.event ?? null });
  }

  const parsed = evolutionWebhookSchema.safeParse(body);

  if (!parsed.success) {
    console.warn("[evolution-webhook] invalid payload", parsed.error.flatten());
    void logSystemEvent({
      source: "evolution-webhook",
      event: "invalid_payload",
      severity: "warning",
      message: "Payload da Evolution nao corresponde ao formato esperado.",
      metadata: parsed.error.flatten()
    });
    return NextResponse.json({ error: "Payload invalido.", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ignoredChatReason = getIgnorableChatReason(parsed.data.data.key.remoteJid);
  if (ignoredChatReason) {
    console.info("[evolution-webhook] ignored non individual chat", {
      reason: ignoredChatReason,
      remoteJid: maskJid(parsed.data.data.key.remoteJid),
      messageType: parsed.data.data.messageType
    });
    return NextResponse.json({ ignored: true, reason: ignoredChatReason });
  }

  const inbound = normalizeEvolutionMessage(parsed.data);
  if (!inbound) {
    console.info("[evolution-webhook] ignored unsupported or empty message");
    void logSystemEvent({
      source: "evolution-webhook",
      event: "unsupported_message",
      severity: "info",
      message: "Mensagem vazia, de tipo ainda nao suportado ou enviada pelo proprio sistema foi ignorada.",
      metadata: {
        messageType: parsed.data.data.messageType,
        fromMe: parsed.data.data.key?.fromMe
      }
    });
    return NextResponse.json({ ignored: true });
  }

  try {
    const result = await registerInboundMessage(inbound);
    triggerDueFollowUpsInBackground({ source: "evolution-webhook", limit: 10 });

    if (!result.duplicated && !inbound.fromMe && result.conversation.status === "ai") {
      const bufferWindowMs = getMessageBufferWindowMs();
      setTimeout(() => {
        processBufferedConversation(result.conversation.id).catch((error) => {
          console.error("[evolution-webhook] buffer processing failed", error);
          void logSystemEvent({
            source: "message-buffer",
            event: "buffer_processing_failed",
            severity: "error",
            message: error instanceof Error ? error.message : "Falha ao processar buffer da IA.",
            leadId: result.lead.id,
            conversationId: result.conversation.id
          });
        });
      }, bufferWindowMs);
    }

    console.info("[evolution-webhook] message registered", {
      conversationId: result.conversation.id,
      leadId: result.lead.id
    });
    void logSystemEvent({
      source: "evolution-webhook",
      event: result.duplicated ? "duplicate_message_ignored" : "message_registered",
      severity: result.duplicated ? "warning" : "success",
      message: result.duplicated
        ? "Mensagem duplicada da Evolution ignorada para evitar registro repetido."
        : "Mensagem recebida, lead/conversa atualizados e buffer preparado.",
      leadId: result.lead.id,
      conversationId: result.conversation.id,
      metadata: {
        messageType: inbound.messageType,
        fromMe: inbound.fromMe,
        bufferMs: getMessageBufferWindowMs(),
        conversationStatus: result.conversation.status
      }
    });

    return NextResponse.json({ ok: true, conversationId: result.conversation.id });
  } catch (error) {
    console.error("[evolution-webhook] failed to register inbound message", error);
    void logSystemEvent({
      source: "evolution-webhook",
      event: "register_inbound_failed",
      severity: "error",
      message: error instanceof Error ? error.message : "Falha ao registrar mensagem recebida.",
      metadata: {
        event: body?.event,
        instance: body?.instance,
        messageType: body?.data?.messageType,
        fromMe: body?.data?.key?.fromMe
      }
    });
    return NextResponse.json(
      { error: "Falha ao registrar mensagem recebida." },
      { status: 500 }
    );
  }
}

function maskJid(value: string) {
  const [id, suffix] = value.split("@");
  const maskedId = id.replace(/\d(?=\d{4})/g, "*");
  return suffix ? `${maskedId}@${suffix}` : maskedId;
}

function getWebhookSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return (
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-evolution-webhook-secret") ??
    request.headers.get("x-api-key") ??
    request.headers.get("apikey") ??
    bearer ??
    request.nextUrl.searchParams.get("secret")
  );
}
