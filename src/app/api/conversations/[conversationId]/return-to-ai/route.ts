import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { returnConversationToAi } from "@/lib/services/conversation-service";
import { assertPermission } from "@/lib/services/permission-service";
import { handoffSchema } from "@/lib/validators/evolution";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "returnToAi");

    const params = await context.params;
    const body = handoffSchema.parse(await request.json().catch(() => ({})));
    const conversation = await returnConversationToAi(params.conversationId, session.userId, body.reason);

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[conversation-handoff] failed to return conversation to ai", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel devolver a conversa para IA." },
      { status: error instanceof Error && error.message.includes("Sem permissao") ? 403 : 500 }
    );
  }
}
