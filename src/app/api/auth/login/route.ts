import { NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/lib/services/auth-service";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Informe o email e a senha para entrar." }, { status: 400 });
    }

    const body = parsed.data;
    const result = await login(body);

    if (result.passwordChangeRequired) {
      return NextResponse.json({
        passwordChangeRequired: true,
        passwordChangeUrl: result.passwordChangeUrl,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role
        }
      });
    }

    return NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const databaseError = message.includes("Failed query") || message.includes("ECONNREFUSED");

    return NextResponse.json(
      {
        error: databaseError
          ? "Banco de dados local indisponivel ou sem schema. Inicie o Postgres e rode npm run db:push."
          : message || "Nao foi possivel entrar."
      },
      { status: 401 }
    );
  }
}
