import { NextResponse } from "next/server";
import { z } from "zod";
import { recoverSuperAdminAccess } from "@/lib/services/auth-service";

const schema = z.object({
  email: z.string().email(),
  recoverySecret: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await recoverSuperAdminAccess(body);

    return NextResponse.json({
      ok: true,
      emailSent: result.emailSent,
      inviteUrl: result.inviteUrl,
      inviteUrlVisible: result.inviteUrlVisible,
      message: result.emailSent
        ? "Enviamos um link para recuperar o acesso do superadmin."
        : result.inviteUrl
          ? "Link de recuperacao gerado."
          : "Recuperacao solicitada. Configure o envio de email ou use o segredo de recuperacao para exibir o link."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel recuperar o acesso." },
      { status: 400 }
    );
  }
}
