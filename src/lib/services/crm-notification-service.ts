import { db } from "@/lib/db/client";
import { crmNotifications } from "@/lib/db/schema";
import { SYSTEM_USER_ID } from "@/lib/constants";
import { env } from "@/lib/env";
import { sendWhatsAppText } from "@/lib/services/evolution-api";

type CreateCrmNotificationInput = {
  leadId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  type: "payment_receipt" | "purchase_intent" | "pending_lead" | "human_required" | "human_requested";
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

export async function createCrmNotification(input: CreateCrmNotificationInput) {
  const [notification] = await db
    .insert(crmNotifications)
    .values({
      lead_id: input.leadId ?? null,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload ?? {},
      modified_by: SYSTEM_USER_ID
    })
    .returning();

  await sendInternalWhatsAppNotification({
    title: input.title,
    body: input.body,
    payload: input.payload
  });

  return notification;
}

async function sendInternalWhatsAppNotification(input: {
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}) {
  const recipients = getNotificationRecipients();
  if (recipients.length === 0) return;

  const conversationUrl = typeof input.payload?.conversationUrl === "string"
    ? new URL(input.payload.conversationUrl, env.APP_URL).toString()
    : null;

  const text = [
    "[ALERTA INTERNO AUTO PRO IA]",
    "",
    input.title,
    input.body,
    conversationUrl ? `Abrir conversa: ${conversationUrl}` : null
  ].filter(Boolean).join("\n");

  await Promise.allSettled(
    recipients.map(async (phone) => {
      try {
        await sendWhatsAppText({ phone, text });
      } catch (error) {
        console.warn("[crm-notification] whatsapp notification failed", {
          phone: maskPhone(phone),
          error: error instanceof Error ? error.message : "Falha desconhecida"
        });
      }
    })
  );
}

function getNotificationRecipients() {
  return Array.from(
    new Set(
      (env.NOTIFICATION_WHATSAPP_NUMBERS ?? "")
        .split(",")
        .map((phone) => phone.replace(/\D/g, ""))
        .filter((phone) => phone.length >= 12)
    )
  );
}

function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{4})/g, "*");
}
