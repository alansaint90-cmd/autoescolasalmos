import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { generateAiManualSuggestion } from "@/lib/services/ai-agent";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

type ConversationContextRow = {
  conversation_id: string;
  lead_name: string | null;
  context_summary: string | null;
  messages: Array<{
    role: "lead" | "ai" | "human" | "system";
    content: string;
  }> | null;
};

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Sessao invalida") || message.includes("expirada")) return 401;
  if (message.includes("Sem permissao")) return 403;

  return 500;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "replyConversations");

    const body = (await request.json().catch(() => ({}))) as { leadId?: string };
    const leadId = body.leadId?.trim();

    if (!leadId) {
      return NextResponse.json({ error: "Informe o lead para gerar a sugestao." }, { status: 400 });
    }

    const [context] = await db.execute<ConversationContextRow>(sql`
      select
        c.id as conversation_id,
        l.name as lead_name,
        c.context_summary,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'role', ordered_messages.role,
                'content', ordered_messages.content
              )
              order by ordered_messages.created_at asc
            )
            from (
              select m.role, m.content, m.created_at
              from messages m
              where m.conversation_id = c.id
                and m.is_deleted = false
                and (c.cleared_at is null or m.created_at > c.cleared_at)
              order by m.created_at desc
              limit 18
            ) ordered_messages
          ),
          '[]'::json
        ) as messages
      from conversations c
      inner join leads l on l.id = c.lead_id and l.is_deleted = false
      where c.lead_id = ${leadId}
        and c.is_deleted = false
      order by c.last_message_at desc
      limit 1
    `);

    if (!context) {
      return NextResponse.json({ error: "Conversa nao encontrada para este lead." }, { status: 404 });
    }

    const messages = (context.messages ?? []).filter((message) => message.content?.trim());
    if (messages.length === 0) {
      return NextResponse.json({ error: "Ainda nao ha mensagens suficientes para gerar uma sugestao contextual." }, { status: 400 });
    }

    const suggestion = await generateAiManualSuggestion({
      leadName: context.lead_name,
      contextSummary: context.context_summary,
      messages
    });

    return NextResponse.json({
      ok: true,
      suggestion: suggestion.text,
      safety: suggestion.safety
    });
  } catch (error) {
    console.error("[conversation-suggestion] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel gerar sugestao da IA." },
      { status: errorStatus(error) }
    );
  }
}
