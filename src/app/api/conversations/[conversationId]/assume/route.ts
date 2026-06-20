import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assumeConversation } from "@/lib/services/conversation-service";
import { assertPermission } from "@/lib/services/permission-service";
import { handoffSchema } from "@/lib/validators/evolution";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "assumeAi");

    const params = await context.params;
    const body = handoffSchema.parse(await request.json().catch(() => ({})));
    const conversation = await assumeConversation(params.conversationId, session.userId, body.reason);

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[conversation-handoff] failed to assume conversation", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel pausar a IA." },
      { status: error instanceof Error && error.message.includes("Sem permissao") ? 403 : 500 }
    );
  }
}
