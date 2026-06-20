import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { defaultAiBusinessSettings } from "@/lib/ai-business-settings";
import { getAiBusinessSettings } from "@/lib/services/ai-business-settings-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Sessao invalida ou expirada." }, { status: 401 });
  }

  try {
    const settings = await getAiBusinessSettings();
    return NextResponse.json({ ok: true, agentName: settings.agentName });
  } catch {
    return NextResponse.json({ ok: true, agentName: defaultAiBusinessSettings.agentName });
  }
}
