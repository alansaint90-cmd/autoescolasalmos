import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createPdfBuffer } from "@/lib/services/report-query-service";
import { assertPermission } from "@/lib/services/permission-service";
import { buildOnboardingPdfLines, getClientWithOnboarding } from "@/lib/services/client-onboarding-service";

export async function GET(request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const { clientId } = await context.params;
    const client = await getClientWithOnboarding(clientId);

    if (!client || !client.onboarding) {
      return NextResponse.json({ error: "Onboarding nao encontrado." }, { status: 404 });
    }

    const lines = buildOnboardingPdfLines({
      clientName: client.name,
      responses: client.onboarding.responses,
      files: client.onboarding.files,
      completedAt: client.onboarding.completed_at
    });
    const pdf = createPdfBuffer(lines);
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    const fileName = `onboarding-${slugify(client.name)}.pdf`;

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel gerar PDF." },
      { status: 403 }
    );
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cliente";
}
