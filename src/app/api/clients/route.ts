import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient, listClientsWithOnboarding } from "@/lib/services/client-onboarding-service";
import { assertPermission } from "@/lib/services/permission-service";

const createClientSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional()
});

export async function GET() {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");

    const clients = await listClientsWithOnboarding();
    return NextResponse.json({ clients });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar clientes." },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageAi");
    const body = createClientSchema.parse(await request.json());

    const client = await createClient({
      ...body,
      modifiedBy: session.userId
    });

    return NextResponse.json({ client });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel criar cliente." },
      { status: 400 }
    );
  }
}
