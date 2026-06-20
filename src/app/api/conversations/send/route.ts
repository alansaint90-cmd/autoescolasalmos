import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { appendRecentConversationContext, clearConversationBuffer } from "@/lib/services/message-buffer";
import { assertPermission } from "@/lib/services/permission-service";
import { pauseLeadFollowUp } from "@/lib/services/follow-up-service";
import { moveLeadStageIfOpen } from "@/lib/services/funnel-stage-service";
import { publishRealtimeEvent } from "@/lib/services/realtime";
import { normalizeEvolutionSendResults, sanitizeWhatsAppText, sendWhatsAppMedia, sendWhatsAppText } from "@/lib/services/evolution-api";

export const runtime = "nodejs";

type ConversationTarget = {
  conversation_id: string;
  lead_id: string;
  lead_name: string | null;
  phone: string;
};

type CreatedMessage = {
  id: string;
  created_at: Date | string;
};

const attachmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["audio", "image", "video"]),
  dataUrl: z.string().min(1)
});

const sendMessageSchema = z.object({
  leadId: z.string().min(1),
  text: z.string().default(""),
  attachment: attachmentSchema.optional()
});

function formatMessageTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "ontem" : `${diffDays} dias`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "replyConversations");

    const body = sendMessageSchema.parse(await request.json().catch(() => ({})));
    const leadId = body.leadId.trim();
    const text = sanitizeWhatsAppText(body.text);
    const attachment = body.attachment;

    if (!leadId || (!text && !attachment)) {
      return NextResponse.json({ error: "Informe o lead e a mensagem para envio." }, { status: 400 });
    }

    const [target] = await db.execute<ConversationTarget>(sql`
      select
        c.id as conversation_id,
        l.id as lead_id,
        l.name as lead_name,
        l.phone
      from conversations c
      inner join leads l on l.id = c.lead_id and l.is_deleted = false
      where c.lead_id = ${leadId}
        and c.is_deleted = false
      order by c.last_message_at desc
      limit 1
    `);

    if (!target) {
      return NextResponse.json({ error: "Conversa nao encontrada para este lead." }, { status: 404 });
    }

    const evolutionResults = [];
    if (attachment) {
      evolutionResults.push(...normalizeEvolutionSendResults(await sendWhatsAppMedia({
        phone: target.phone,
        mediaType: attachment.type,
        mediaDataUrl: attachment.dataUrl,
        fileName: attachment.name,
        caption: text || undefined
      })));
    } else {
      evolutionResults.push(...normalizeEvolutionSendResults(await sendWhatsAppText({ phone: target.phone, text })));
    }

    const messageContent = text || `${attachment?.type === "audio" ? "Audio" : attachment?.type === "image" ? "Imagem" : "Video"}: ${attachment?.name}`;

    const [createdMessage] = await db.execute<CreatedMessage>(sql`
      insert into messages (conversation_id, external_message_id, role, content, metadata, modified_by)
      values (
        ${target.conversation_id},
        ${evolutionResults[0]?.messageId ?? null},
        'human',
        ${messageContent},
        ${JSON.stringify({
          source: "manual",
          userId: session.userId,
          sender: session.name,
          senderRole: session.role,
          attachment: attachment ? { name: attachment.name, type: attachment.type } : null,
          evolutionMessageKeys: evolutionResults.map((result) => result.key).filter(Boolean)
        })}::jsonb,
        ${session.userId}
      )
      returning id, created_at
    `);

    await db.execute(sql`
      update conversations
      set
        status = 'human',
        assigned_to = ${session.userId},
        ai_paused_reason = ${`Piloto humano: ${session.name}`},
        last_message_at = now(),
        updated_at = now(),
        modified_by = ${session.userId}
      where id = ${target.conversation_id}
    `);

    await moveLeadStageIfOpen({
      leadId: target.lead_id,
      toStage: "atendimento",
      conversationId: target.conversation_id,
      messageId: createdMessage?.id,
      reason: "Operador enviou mensagem manual na conversa.",
      actor: "Operador",
      modifiedBy: session.userId,
      updates: {
        last_message_preview: messageContent,
        last_interaction_at: new Date()
      }
    });
    await clearConversationBuffer(target.conversation_id);
    await pauseLeadFollowUp(target.lead_id, session.userId);

    const message = {
      id: createdMessage?.id ?? randomUUID(),
      from: "human" as const,
      text: messageContent,
      time: createdMessage?.created_at ? formatMessageTime(createdMessage.created_at) : "agora",
      senderName: session.name,
      senderRole: session.role,
      media: attachment
        ? {
          type: attachment.type,
          dataUrl: attachment.dataUrl,
          fileName: attachment.name
        }
        : undefined
    };

    await appendRecentConversationContext({
      conversationId: target.conversation_id,
      messageId: message.id,
      role: "human",
      content: messageContent,
      createdAt: new Date().toISOString()
    });

    await publishRealtimeEvent({
      type: "message.created",
      conversationId: target.conversation_id,
      payload: {
        message,
        leadId: target.lead_id
      }
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem.";
    const status = message.toLowerCase().includes("permiss") || message.toLowerCase().includes("sessao") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
