import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  pauseLeadFollowUp,
  resumeLeadFollowUp,
  sendFollowUpNow
} from "@/lib/services/follow-up-service";
import { assertPermission } from "@/lib/services/permission-service";

export const runtime = "nodejs";

type FollowUpAction = "send-now" | "pause" | "resume";

function normalizeAction(value: unknown): FollowUpAction | null {
  if (value === "send-now" || value === "pause" || value === "resume") return value;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "replyConversations");

    const body = await request.json().catch(() => ({})) as { leadId?: unknown; action?: unknown };
    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    const action = normalizeAction(body.action);

    if (!leadId || !action) {
      return NextResponse.json({ error: "Informe lead e acao de follow-up." }, { status: 400 });
    }

    if (action === "pause") {
      await pauseLeadFollowUp(leadId, session.userId);
      return NextResponse.json({ ok: true, action });
    }

    if (action === "resume") {
      await resumeLeadFollowUp(leadId, session.userId);
      return NextResponse.json({ ok: true, action });
    }

    const result = await sendFollowUpNow(leadId);
    return NextResponse.json({ ok: true, action, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel executar follow-up." },
      { status: 403 }
    );
  }
}
