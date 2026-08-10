import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { deleteClientWithOnboarding, getClientWithOnboarding, updateClient } from "@/lib/services/client-onboarding-service";
import { assertPermission } from "@/lib/services/permission-service";

const updateClientSchema = z.object({
  name: z.string().min(2).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional()
});

export async function GET(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const { clientId } = await context.params;
    const client = await getClientWithOnboarding(clientId);

    if (!client) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar cliente." },
      { status: 401 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const { clientId } = await context.params;
    const body = updateClientSchema.parse(await request.json());

    const client = await updateClient({
      clientId,
      ...body,
      modifiedBy: session.userId
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel atualizar cliente." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ clientId: string }> }) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const { clientId } = await context.params;

    const client = await deleteClientWithOnboarding(clientId, session.userId);

    if (!client) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel apagar cliente." },
      { status: 400 }
    );
  }
}
