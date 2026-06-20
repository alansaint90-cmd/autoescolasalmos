import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();

    return NextResponse.json({
      ok: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role
      }
    });
  } catch {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }
}
