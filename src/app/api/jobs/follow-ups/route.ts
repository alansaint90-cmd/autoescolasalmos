import { NextRequest, NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { previewDueFollowUps, processDueFollowUps } from "@/lib/services/follow-up-service";
import { assertPermission } from "@/lib/services/permission-service";
import { logSystemEvent } from "@/lib/services/system-event-log-service";

export const runtime = "nodejs";

function getInternalSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return (
    request.headers.get("x-internal-secret") ??
    request.headers.get("x-follow-up-job-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-api-key") ??
    bearer ??
    request.nextUrl.searchParams.get("secret")
  );
}

function matchesJobSecret(secret: string | null | undefined) {
  const acceptedSecrets = [
    env.FOLLOW_UP_JOB_SECRET,
    env.EVOLUTION_WEBHOOK_SECRET
  ].filter((value): value is string => Boolean(value));

  return Boolean(secret && acceptedSecrets.includes(secret));
}

async function canProcessFollowUps(request: NextRequest) {
  const secret = getInternalSecret(request);
  if (matchesJobSecret(secret)) {
    return true;
  }

  const session = await getOptionalSession();
  if (!session) return false;

  await assertPermission(session.role, "manageAi");
  return true;
}

async function runFollowUps(request: NextRequest, limit: number) {
  try {
    const authorized = await canProcessFollowUps(request);
    if (!authorized) {
      void logSystemEvent({
        source: "follow-up-job",
        event: "follow_up_job_unauthorized",
        severity: "warning",
        message: "Chamada do cron de follow-up recusada por falta de segredo valido.",
        metadata: {
          hasAuthorization: Boolean(request.headers.get("authorization")),
          hasInternalSecret: Boolean(request.headers.get("x-internal-secret")),
          hasFollowUpSecret: Boolean(request.headers.get("x-follow-up-job-secret")),
          hasQuerySecret: Boolean(request.nextUrl.searchParams.get("secret"))
        }
      });
      return NextResponse.json({ error: "Acesso nao autorizado." }, { status: 401 });
    }

    if (request.nextUrl.searchParams.get("dryRun") === "true") {
      const preview = await previewDueFollowUps(Number.isFinite(limit) ? limit : 25);
      return NextResponse.json({ ok: true, dryRun: true, ...preview });
    }

    const result = await processDueFollowUps(Number.isFinite(limit) ? limit : 25);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel processar follow-ups." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  return runFollowUps(request, limit);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { limit?: unknown };
  const limit = typeof body.limit === "number" ? body.limit : Number(body.limit ?? 25);
  return runFollowUps(request, limit);
}
