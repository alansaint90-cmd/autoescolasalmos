import { NextResponse } from "next/server";
import { ensureSuperAdmin } from "@/lib/services/auth-service";

export async function POST() {
  try {
    const result = await ensureSuperAdmin();

    return NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        passwordReady: Boolean(result.user.password_set_at),
        firstAccessRequired: !result.user.password_set_at
      },
      inviteUrl: result.inviteUrl,
      emailSent: result.emailSent ?? false
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel preparar o superadmin." },
      { status: 500 }
    );
  }
}
