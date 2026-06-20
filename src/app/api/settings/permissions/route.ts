import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertPermission, getRolePermissions, saveRolePermissions } from "@/lib/services/permission-service";

export async function GET() {
  try {
    await getSession();
    const permissions = await getRolePermissions();
    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado." },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    await assertPermission(session.role, "manageUsers");

    const body = await request.json().catch(() => ({}));
    const permissions = await saveRolePermissions(body.permissions);

    return NextResponse.json({ permissions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel salvar as permissoes." },
      { status: 403 }
    );
  }
}
