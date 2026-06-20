import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Demo indisponivel em producao." }, { status: 404 });
  }

  await createSessionCookie(
    {
      userId: "demo-user",
      role: "super_admin",
      name: "Usuario Demo",
      email: "demo@autopro.ia"
    },
    false
  );

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
