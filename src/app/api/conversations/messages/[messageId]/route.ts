import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { assertPermission } from "@/lib/services/permission-service";
import { deleteWhatsAppMessageForEveryone, EvolutionMessageKey, updateWhatsAppText } from "@/lib/services/evolution-api";

export const runtime = "nodejs";

type MessageMutationRow = {
  id: string;
  conversation_id: string;
  content: string;
  external_message_id: string | null;
  metadata: Record<string, unknown> | null;
  external_chat_id: string | null;
  phone: string | null;
};

const editMessageSchema = z.object({
  content: z.string().trim().min(1, "A mensagem nao pode ficar vazia.")
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "replyConversations");

    const params = await context.params;
    const messageId = params.messageId;
    const body = editMessageSchema.parse(await request.json().catch(() => ({})));

    const existing = await findSentMessage(messageId);
    if (!existing) {
      return NextResponse.json({ error: "Mensagem enviada nao encontrada para edicao." }, { status: 404 });
    }

    const remoteKeys = getRemoteMessageKeys(existing);
    if (remoteKeys.length === 0) {
      return NextResponse.json(
        { error: "Esta mensagem nao possui ID remoto da Evolution. Ela pode ser antiga e nao pode ser editada no WhatsApp." },
        { status: 409 }
      );
    }

    await updateWhatsAppText({
      phone: existing.phone ?? "",
      text: body.content,
      key: remoteKeys[0]
    });

    for (const extraKey of remoteKeys.slice(1)) {
      await deleteWhatsAppMessageForEveryone({ key: extraKey });
    }

    const editMetadata = {
      edited: true,
      editedAt: new Date().toISOString(),
      editedBy: session.userId,
      remoteEdited: true,
      remoteEditedAt: new Date().toISOString(),
      evolutionMessageKeys: [remoteKeys[0]]
    };

    const [message] = await db.execute<MessageMutationRow>(sql`
      update messages
      set
        content = ${body.content},
        metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify(editMetadata)}::jsonb,
        updated_at = now(),
        modified_by = ${session.userId}
      where id = ${messageId}
        and is_deleted = false
        and role in ('ai', 'human')
      returning id, conversation_id, content, external_message_id, metadata, null::text as external_chat_id, null::text as phone
    `);

    await refreshConversationPreview(message.conversation_id, session.userId);

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel editar a mensagem." },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "replyConversations");

    const params = await context.params;
    const messageId = params.messageId;

    const existing = await findSentMessage(messageId);
    if (!existing) {
      return NextResponse.json({ error: "Mensagem enviada nao encontrada para exclusao." }, { status: 404 });
    }

    const remoteKeys = getRemoteMessageKeys(existing);
    if (remoteKeys.length > 0) {
      for (const remoteKey of remoteKeys) {
        await deleteWhatsAppMessageForEveryone({ key: remoteKey });
      }
    }

    const remoteDeleted = remoteKeys.length > 0;
    const warning = remoteDeleted
      ? null
      : "Mensagem apagada apenas no painel. Ela nao possui ID remoto da Evolution, entao nao foi possivel apagar no WhatsApp.";
    const deleteMetadata = {
      deletedFromChat: true,
      deletedAt: new Date().toISOString(),
      deletedBy: session.userId,
      remoteDeleted,
      remoteDeletedAt: remoteDeleted ? new Date().toISOString() : null,
      remoteDeleteSkippedReason: warning
    };

    const [message] = await db.execute<MessageMutationRow>(sql`
      update messages
      set
        is_deleted = true,
        deleted_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify(deleteMetadata)}::jsonb,
        updated_at = now(),
        modified_by = ${session.userId}
      where id = ${messageId}
        and is_deleted = false
        and role in ('ai', 'human')
      returning id, conversation_id, content, external_message_id, metadata, null::text as external_chat_id, null::text as phone
    `);

    await refreshConversationPreview(message.conversation_id, session.userId);

    return NextResponse.json({ ok: true, remoteDeleted, warning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel apagar a mensagem." },
      { status: 500 }
    );
  }
}

async function findSentMessage(messageId: string) {
  const [message] = await db.execute<MessageMutationRow>(sql`
    select
      m.id,
      m.conversation_id,
      m.content,
      m.external_message_id,
      m.metadata,
      c.external_chat_id,
      l.phone
    from messages m
    inner join conversations c on c.id = m.conversation_id and c.is_deleted = false
    inner join leads l on l.id = c.lead_id and l.is_deleted = false
    where m.id = ${messageId}
      and m.is_deleted = false
      and m.role in ('ai', 'human')
    limit 1
  `);

  return message ?? null;
}

function getRemoteMessageKeys(message: MessageMutationRow): EvolutionMessageKey[] {
  const keysFromMetadata = Array.isArray(message.metadata?.evolutionMessageKeys)
    ? message.metadata.evolutionMessageKeys
    : [];

  const keys = keysFromMetadata
    .map((item) => normalizeRemoteKey(item, message.external_chat_id))
    .filter((item): item is EvolutionMessageKey => Boolean(item));

  if (keys.length > 0) return keys;

  return message.external_message_id
    ? [normalizeRemoteKey({ id: message.external_message_id }, message.external_chat_id)].filter((item): item is EvolutionMessageKey => Boolean(item))
    : [];
}

function normalizeRemoteKey(value: unknown, remoteJid: string | null): EvolutionMessageKey | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : null;
  if (!id) return null;

  return {
    id,
    remoteJid: typeof candidate.remoteJid === "string" ? candidate.remoteJid : remoteJid ?? undefined,
    fromMe: typeof candidate.fromMe === "boolean" ? candidate.fromMe : true,
    participant: typeof candidate.participant === "string" ? candidate.participant : undefined
  };
}

async function refreshConversationPreview(conversationId: string, userId: string) {
  await db.execute(sql`
    with target as (
      select c.id as conversation_id, c.lead_id
      from conversations c
      where c.id = ${conversationId}
        and c.is_deleted = false
      limit 1
    ),
    latest as (
      select target.lead_id, m.content, m.created_at
      from target
      left join lateral (
        select content, created_at
        from messages
        where conversation_id = target.conversation_id
          and is_deleted = false
        order by created_at desc
        limit 1
      ) m on true
    )
    update leads
    set
      last_message_preview = coalesce((select content from latest), last_message_preview),
      last_interaction_at = coalesce((select created_at from latest), last_interaction_at),
      updated_at = now(),
      modified_by = ${userId}
    where id = (select lead_id from latest)
      and is_deleted = false
  `);

  await db.execute(sql`
    update conversations
    set
      last_message_at = coalesce(
        (
          select created_at
          from messages
          where conversation_id = ${conversationId}
            and is_deleted = false
          order by created_at desc
          limit 1
        ),
        last_message_at
      ),
      updated_at = now(),
      modified_by = ${userId}
    where id = ${conversationId}
      and is_deleted = false
  `);
}
