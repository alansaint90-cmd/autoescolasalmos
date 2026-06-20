import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAiControlSettings, saveAiControlSettings } from "@/lib/services/ai-control-service";
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

    const settings = await getAiControlSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[ai-control] failed to load", error);
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

    const body = (await request.json().catch(() => ({}))) as {
      whatsappPaused?: boolean;
      pausedReason?: string;
    };

    const settings = await saveAiControlSettings({
      whatsappPaused: Boolean(body.whatsappPaused),
      pausedReason: body.pausedReason ?? ""
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[ai-control] failed to save", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel atualizar o controle da IA." },
      { status: errorStatus(error) }
    );
  }
}
