import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/auth-service";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await requestPasswordReset(body);

    return NextResponse.json({
      ok: true,
      emailSent: result.emailSent,
      resetUrl: result.resetUrl,
      resetUrlVisible: result.resetUrlVisible,
      message: result.emailSent
        ? "Enviamos um link de recuperacao para o email informado."
        : result.resetUrl
          ? "Link de recuperacao gerado."
          : "Se este email estiver cadastrado, enviaremos um link de recuperacao."
    });
  } catch {
    return NextResponse.json({
      ok: true,
      message: "Se este email estiver cadastrado, enviaremos um link de recuperacao."
    });
  }
}
