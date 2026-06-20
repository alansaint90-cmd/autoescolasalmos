import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { type PermissionKey } from "@/lib/permissions";
import { canRole } from "@/lib/services/permission-service";

export async function GET(request: NextRequest) {
  try {
    const permission = request.nextUrl.searchParams.get("permission") as PermissionKey | null;

    if (!permission) {
      return NextResponse.json({ error: "Informe a permissao." }, { status: 400 });
    }

    const session = await getSession();
    const allowed = await canRole(session.role, permission);

    return NextResponse.json({ allowed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Acesso nao autorizado.", allowed: false },
      { status: 401 }
    );
  }
}
