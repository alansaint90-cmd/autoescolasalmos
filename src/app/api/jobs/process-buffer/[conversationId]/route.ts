import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { processBufferedConversation } from "@/lib/services/conversation-service";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

function getInternalSecret(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return (
    request.headers.get("x-internal-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-api-key") ??
    bearer
  );
}

async function canProcessBuffer(request: Request) {
  const secret = getInternalSecret(request);
  if (env.EVOLUTION_WEBHOOK_SECRET && secret === env.EVOLUTION_WEBHOOK_SECRET) {
    return true;
  }

  const session = await getOptionalSession();
  if (!session) return false;

  await assertPermission(session.role, "manageAi");
  return true;
}

export async function POST(request: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const authorized = await canProcessBuffer(request);
    if (!authorized) {
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado." },
      { status: 403 }
    );
  }

  const params = await context.params;
  const result = await processBufferedConversation(params.conversationId);

  return NextResponse.json(result);
}
