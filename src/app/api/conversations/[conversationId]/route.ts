import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { conversations } from "@/lib/db/schema";
import { clearConversationBuffer } from "@/lib/services/message-buffer";
import { assertPermission } from "@/lib/services/permission-service";
import { pauseLeadFollowUp } from "@/lib/services/follow-up-service";
import { moveLeadStageIfOpen } from "@/lib/services/funnel-stage-service";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["archive", "unarchive", "mute", "unmute", "pin", "unpin", "block", "unblock", "clear", "delete"])
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  const session = await getSession();
  await assertPermission(session.role, "replyConversations");

  const params = await context.params;
  const body = actionSchema.parse(await request.json().catch(() => ({})));
  const now = new Date();

  const [current] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.conversationId), eq(conversations.is_deleted, false)))
    .limit(1);

  if (!current) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 });
  }

  if (body.action === "delete") {
    await clearConversationBuffer(params.conversationId);
    await db
      .update(conversations)
      .set({
        is_deleted: true,
        deleted_at: now,
        status: "closed",
        updated_at: now,
        modified_by: session.userId
      })
      .where(eq(conversations.id, params.conversationId));

    return NextResponse.json({ ok: true, action: body.action });
  }

  if (body.action === "clear") {
    await db.execute(sql`
      update messages
      set is_deleted = true, deleted_at = now(), updated_at = now(), modified_by = ${session.userId}
      where conversation_id = ${params.conversationId}
        and is_deleted = false
    `);
  }

  if (body.action === "block") {
    await clearConversationBuffer(params.conversationId);
  }

  const [updated] = await db
    .update(conversations)
    .set({
      archived_at: body.action === "archive" ? now : body.action === "unarchive" ? null : current.archived_at,
      muted_at: body.action === "mute" ? now : body.action === "unmute" ? null : current.muted_at,
      pinned_at: body.action === "pin" ? now : body.action === "unpin" ? null : current.pinned_at,
      blocked_at: body.action === "block" ? now : body.action === "unblock" ? null : current.blocked_at,
      cleared_at: body.action === "clear" ? now : current.cleared_at,
      status: body.action === "block" ? "human" : current.status,
      ai_paused_reason: body.action === "block" ? "Conversa bloqueada pelo atendente." : current.ai_paused_reason,
      updated_at: now,
      modified_by: session.userId
    })
    .where(eq(conversations.id, params.conversationId))
    .returning();

  if (body.action === "block") {
    await pauseLeadFollowUp(current.lead_id, session.userId);
    await moveLeadStageIfOpen({
      leadId: current.lead_id,
      toStage: "atendimento",
      conversationId: params.conversationId,
      reason: "Conversa bloqueada pelo atendente; IA pausada.",
      actor: "Operador",
      modifiedBy: session.userId
    });
  }

  return NextResponse.json({ ok: true, action: body.action, conversation: updated });
}
