import { NextResponse } from "next/server";
import { z } from "zod";
import type { Role } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";
import { inviteUser } from "@/lib/services/auth-service";
import { assertPermission } from "@/lib/services/permission-service";

const allowedRoles = ["gerente", "atendente", "operador", "visualizador"] as const;

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(allowedRoles)
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageUsers");

    const body = schema.parse(await request.json());
    const invite = await inviteUser({ ...body, role: body.role as Role });

    return NextResponse.json(invite);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel enviar o convite." },
      { status: 400 }
    );
  }
}
