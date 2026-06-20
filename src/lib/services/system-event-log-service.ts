import { SYSTEM_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { systemEventLogs } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { sendWhatsAppText } from "@/lib/services/evolution-api";

type SystemEventSeverity = "info" | "success" | "warning" | "error";

type LogSystemEventInput = {
  source: string;
  event: string;
  severity?: SystemEventSeverity;
  message: string;
  leadId?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
  modifiedBy?: string;
};

export async function logSystemEvent(input: LogSystemEventInput) {
  try {
    await db.insert(systemEventLogs).values({
      source: input.source.slice(0, 120),
      event: input.event.slice(0, 160),
      severity: input.severity ?? "info",
      message: input.message.slice(0, 1200),
      lead_id: input.leadId ?? null,
      conversation_id: input.conversationId ?? null,
      metadata: sanitizeMetadata(input.metadata ?? {}),
      modified_by: input.modifiedBy ?? SYSTEM_USER_ID
    });

    if (input.severity === "error") {
      void notifySupportAboutError(input);
    }
  } catch (error) {
    console.warn("[system-event-log] failed to persist event", {
      source: input.source,
      event: input.event,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function notifySupportAboutError(input: LogSystemEventInput) {
  const phone = normalizePhone(env.SUPPORT_WHATSAPP_NUMBER ?? "5571988345088");
  if (!phone) return;

  try {
    await sendWhatsAppText({
      phone,
      text: [
        "[ALERTA TECNICO AUTO PRO IA]",
        "",
        "Erro detectado no painel de logs e decisoes.",
        `Origem: ${input.source}`,
        `Evento: ${input.event}`,
        `Detalhe: ${input.message}`,
        input.leadId ? `Lead ID: ${input.leadId}` : null,
        input.conversationId ? `Conversa ID: ${input.conversationId}` : null,
        "",
        "Acesse o menu Analise para ver a metadata completa."
      ].filter(Boolean).join("\n")
    });
  } catch (error) {
    console.warn("[system-event-log] failed to notify support", {
      phone: maskPhone(phone),
      event: input.event,
      error: error instanceof Error ? error.message : "Falha desconhecida"
    });
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(metadata, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      if (value instanceof Error) return { name: value.name, message: value.message };
      if (typeof value === "bigint") return value.toString();
      return value;
    })
  ) as Record<string, unknown>;
}

function normalizePhone(value: string) {
  const phone = value.replace(/\D/g, "");
  return phone.length >= 12 ? phone : "";
}

function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{4})/g, "*");
}
