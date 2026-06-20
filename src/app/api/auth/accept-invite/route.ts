import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvite } from "@/lib/services/auth-service";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(1),
  name: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await acceptInvite(body);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel criar a senha." },
      { status: 400 }
    );
  }
}
