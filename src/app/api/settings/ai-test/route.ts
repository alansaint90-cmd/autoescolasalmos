import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateAiReply } from "@/lib/services/ai-agent";
import { assertPermission } from "@/lib/services/permission-service";

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Sessao invalida") || message.includes("expirada")) return 401;
  if (message.includes("Sem permissao")) return 403;

  return 500;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    const body = (await request.json().catch(() => ({}))) as {
      leadName?: string;
      message?: string;
      history?: Array<{ role: "lead" | "ai" | "human" | "system"; content: string }>;
    };

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Digite uma mensagem para testar a IA." }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const reply = await generateAiReply({
      leadName: body.leadName?.trim() || "Lead de teste",
      contextSummary: "Conversa de teste interna na aba IA Comercial. Nao enviar WhatsApp real.",
      messages: [...history, { role: "lead", content: message }]
    });

    return NextResponse.json({
      reply: reply.text,
      safety: reply.safety
    });
  } catch (error) {
    console.error("[ai-test] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel testar a IA." },
      { status: errorStatus(error) }
    );
  }
}
