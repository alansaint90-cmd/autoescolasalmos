import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { defaultAiBusinessSettings, type AiBusinessSettings } from "@/lib/ai-business-settings";
import { getAiBusinessSettings, saveAiBusinessSettings } from "@/lib/services/ai-business-settings-service";
import { assertPermission } from "@/lib/services/permission-service";

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Sessao invalida") || message.includes("expirada")) return 401;
  if (message.includes("Sem permissao")) return 403;

  return 500;
}

export async function GET() {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    const settings = await getAiBusinessSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[ai-business-settings] failed to load", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado." },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    const body = (await request.json().catch(() => ({}))) as Partial<AiBusinessSettings>;
    const settings = await saveAiBusinessSettings({
      agentName: body.agentName ?? defaultAiBusinessSettings.agentName,
      prices: body.prices ?? defaultAiBusinessSettings.prices,
      address: body.address ?? defaultAiBusinessSettings.address,
      hours: body.hours ?? defaultAiBusinessSettings.hours,
      customPrompt: body.customPrompt ?? defaultAiBusinessSettings.customPrompt,
      triagePrompt: body.triagePrompt ?? defaultAiBusinessSettings.triagePrompt,
      sdrPrompt: body.sdrPrompt ?? defaultAiBusinessSettings.sdrPrompt,
      orchestratorPrompt: body.orchestratorPrompt ?? defaultAiBusinessSettings.orchestratorPrompt,
      supervisorPrompt: body.supervisorPrompt ?? defaultAiBusinessSettings.supervisorPrompt
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[ai-business-settings] failed to save", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes da IA." },
      { status: errorStatus(error) }
    );
  }
}
