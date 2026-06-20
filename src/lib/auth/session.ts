import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Role } from "@/lib/auth/rbac";

export type Session = {
  userId: string;
  role: Role;
  name: string;
  email: string;
};

type SessionPayload = Session & {
  exp: number;
};

function sign(value: string) {
  return createHmac("sha256", env.AUTH_SESSION_SECRET).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(value?: string): SessionPayload | null {
  if (!value) return null;

  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function createSessionCookie(session: Session, remember = false) {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  const token = encodeSession({ ...session, exp: Date.now() + maxAge * 1000 });
  const cookieStore = await cookies();

  cookieStore.set(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(env.AUTH_COOKIE_NAME);
}

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const payload = decodeSession(cookieStore.get(env.AUTH_COOKIE_NAME)?.value);

  if (!payload) {
    throw new Error("Sessao invalida ou expirada.");
  }

  return {
    userId: payload.userId,
    role: payload.role,
    name: payload.name,
    email: payload.email
  };
}

export async function getOptionalSession(): Promise<Session | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}
