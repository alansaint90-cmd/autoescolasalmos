import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Informe a senha atual e a nova senha." }, { status: 400 });
    }

    const passwordError = validatePasswordStrength(parsed.data.newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
      return NextResponse.json({ error: "Senha atual invalida." }, { status: 401 });
    }

    await db
      .update(users)
      .set({
        password_hash: await hashPassword(parsed.data.newPassword),
        password_set_at: new Date(),
        updated_at: new Date(),
        modified_by: session.userId
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel alterar a senha." },
      { status: 500 }
    );
  }
}
