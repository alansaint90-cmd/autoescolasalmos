import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateOnboardingLink, getClientWithOnboarding } from "@/lib/services/client-onboarding-service";
import { assertPermission } from "@/lib/services/permission-service";

export async function POST(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const { clientId } = await context.params;
    const client = await getClientWithOnboarding(clientId);

    if (!client) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    const result = await generateOnboardingLink(clientId, session.userId);
    return NextResponse.json({
      url: result.url,
      token: result.token,
      onboarding: result.onboarding
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel gerar link." },
      { status: 400 }
    );
  }
}
