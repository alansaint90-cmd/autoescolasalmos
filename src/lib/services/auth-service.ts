import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { Role } from "@/lib/auth/rbac";
import {
  createAuthToken,
  hashAuthToken,
  hashPassword,
  validatePasswordStrength,
  verifyPassword
} from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

export type AuthInviteResult = {
  userId: string;
  inviteUrl: string;
  emailSent: boolean;
};

export type PasswordResetResult = {
  emailSent: boolean;
  resetUrl?: string;
  resetUrlVisible: boolean;
};

export type SuperAdminBootstrapResult = {
  user: typeof users.$inferSelect;
  inviteUrl?: string;
  emailSent?: boolean;
};

export type SuperAdminRecoveryResult = SuperAdminBootstrapResult & {
  inviteUrlVisible: boolean;
};

export type LoginResult =
  | {
      passwordChangeRequired: false;
      user: typeof users.$inferSelect;
    }
  | {
      passwordChangeRequired: true;
      passwordChangeUrl: string;
      user: typeof users.$inferSelect;
    };

const systemUserId = "00000000-0000-0000-0000-000000000001";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function inviteUrl(token: string) {
  return `${env.APP_URL.replace(/\/$/, "")}/criar-senha?token=${encodeURIComponent(token)}`;
}

async function ensureSystemUser() {
  await db
    .insert(users)
    .values({
      id: systemUserId,
      name: "Auto Pro IA",
      email: "sistema@autoproia.local",
      role: "admin",
      modified_by: systemUserId
    })
    .onConflictDoNothing();
}

async function sendInviteEmail(input: { email: string; name: string; url: string }) {
  if (!env.RESEND_API_KEY) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: input.email,
      subject: "Crie sua senha no Auto Pro IA",
      html: `
        <div style="font-family:Arial,sans-serif;background:#0b1120;color:#f9fafb;padding:32px">
          <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #243244;border-radius:18px;padding:28px">
            <h1 style="margin:0 0 12px;font-size:24px">Bem-vindo ao Auto Pro IA</h1>
            <p style="line-height:1.6;color:#cbd5e1">Olá, ${input.name}. Clique no botão abaixo para criar sua senha de acesso.</p>
            <a href="${input.url}" style="display:inline-block;margin-top:18px;background:#FACC15;color:#0B1120;text-decoration:none;font-weight:800;padding:14px 18px;border-radius:12px">Criar senha</a>
            <p style="margin-top:22px;font-size:12px;color:#94a3b8">Este link expira em 24 horas.</p>
          </div>
        </div>
      `
    })
  });

  if (!response.ok) {
    console.warn("[auth] failed to send invite email", await response.text());
  }

  return response.ok;
}

async function sendPasswordResetEmail(input: { email: string; name: string; url: string }) {
  if (!env.RESEND_API_KEY) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: input.email,
      subject: "Redefina sua senha no Auto Pro IA",
      html: `
        <div style="font-family:Arial,sans-serif;background:#0b1120;color:#f9fafb;padding:32px">
          <div style="max-width:560px;margin:auto;background:#111827;border:1px solid #243244;border-radius:18px;padding:28px">
            <h1 style="margin:0 0 12px;font-size:24px">Redefinicao de senha</h1>
            <p style="line-height:1.6;color:#cbd5e1">Ola, ${input.name}. Clique no botao abaixo para criar uma nova senha de acesso.</p>
            <a href="${input.url}" style="display:inline-block;margin-top:18px;background:#FACC15;color:#0B1120;text-decoration:none;font-weight:800;padding:14px 18px;border-radius:12px">Redefinir senha</a>
            <p style="margin-top:22px;font-size:12px;color:#94a3b8">Este link expira em 24 horas.</p>
            <p style="margin-top:10px;font-size:12px;color:#64748b">Se voce nao solicitou esta alteracao, ignore este email.</p>
          </div>
        </div>
      `
    })
  });

  if (!response.ok) {
    console.warn("[auth] failed to send password reset email", await response.text());
  }

  return response.ok;
}

async function createInviteForUser(user: typeof users.$inferSelect) {
  const token = createAuthToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      invite_token_hash: await hashAuthToken(token),
      invite_expires_at: expiresAt,
      invited_at: now,
      updated_at: now,
      modified_by: user.id
    })
    .where(eq(users.id, user.id));

  const url = inviteUrl(token);
  const emailSent = await sendInviteEmail({ email: user.email, name: user.name, url });

  return { inviteUrl: url, emailSent };
}

async function createPasswordResetForUser(user: typeof users.$inferSelect) {
  const token = createAuthToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({
      invite_token_hash: await hashAuthToken(token),
      invite_expires_at: expiresAt,
      invited_at: now,
      updated_at: now,
      modified_by: user.id
    })
    .where(eq(users.id, user.id));

  const url = inviteUrl(token);
  const emailSent = await sendPasswordResetEmail({ email: user.email, name: user.name, url });

  return { resetUrl: url, emailSent };
}

export async function ensureSuperAdmin(): Promise<SuperAdminBootstrapResult> {
  await ensureSystemUser();

  const email = normalizeEmail(env.SUPERADMIN_EMAIL);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    if (!existing.password_set_at) {
      const invite = await createInviteForUser(existing);
      console.info("[auth] superadmin first access invite refreshed", {
        email,
        inviteUrl: invite.inviteUrl,
        emailSent: invite.emailSent
      });

      return { user: existing, ...invite };
    }

    return { user: existing };
  }

  const token = createAuthToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [created] = await db
    .insert(users)
    .values({
      name: env.SUPERADMIN_NAME,
      email,
      role: "super_admin",
      invite_token_hash: await hashAuthToken(token),
      invite_expires_at: expiresAt,
      invited_at: now,
      modified_by: systemUserId
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    const url = inviteUrl(token);
    const emailSent = await sendInviteEmail({ email, name: env.SUPERADMIN_NAME, url });
    console.info("[auth] superadmin invite created", { email, inviteUrl: url, emailSent });
    return { user: created, inviteUrl: url, emailSent };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error("Nao foi possivel preparar o superadmin.");
  }

  return { user };
}

export async function recoverSuperAdminAccess(input: {
  email: string;
  recoverySecret?: string;
}): Promise<SuperAdminRecoveryResult> {
  const email = normalizeEmail(input.email);
  const superAdminEmail = normalizeEmail(env.SUPERADMIN_EMAIL);

  if (email !== superAdminEmail) {
    throw new Error("Email nao corresponde ao superadmin configurado.");
  }

  const bootstrap = await ensureSuperAdmin();
  const user = bootstrap.user;

  if (user.role !== "super_admin") {
    throw new Error("Usuario configurado nao possui papel de superadmin.");
  }

  const invite = await createInviteForUser(user);
  const secretAllowsLink = Boolean(env.AUTH_RECOVERY_SECRET && input.recoverySecret === env.AUTH_RECOVERY_SECRET);
  const localAllowsLink = process.env.NODE_ENV !== "production" && !env.RESEND_API_KEY;
  const inviteUrlVisible = secretAllowsLink || localAllowsLink;

  console.info("[auth] superadmin recovery requested", {
    email,
    emailSent: invite.emailSent,
    inviteUrlVisible
  });

  return {
    user,
    emailSent: invite.emailSent,
    inviteUrl: inviteUrlVisible ? invite.inviteUrl : undefined,
    inviteUrlVisible
  };
}

export async function requestPasswordReset(input: { email: string }): Promise<PasswordResetResult> {
  const email = normalizeEmail(input.email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || user.is_deleted) {
    console.info("[auth] password reset requested for unknown email", { email });
    return {
      emailSent: false,
      resetUrlVisible: false
    };
  }

  const reset = await createPasswordResetForUser(user);
  const resetUrlVisible = process.env.NODE_ENV !== "production" && !env.RESEND_API_KEY;

  console.info("[auth] password reset requested", {
    email,
    emailSent: reset.emailSent,
    resetUrlVisible
  });

  return {
    emailSent: reset.emailSent,
    resetUrl: resetUrlVisible ? reset.resetUrl : undefined,
    resetUrlVisible
  };
}

export async function inviteUser(input: { name: string; email: string; role: Role }) {
  await ensureSystemUser();

  const email = normalizeEmail(input.email);
  const token = createAuthToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tokenHash = await hashAuthToken(token);

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const values = {
    name: input.name.trim(),
    email,
    role: input.role,
    invite_token_hash: tokenHash,
    invite_expires_at: expiresAt,
    invited_at: now,
    modified_by: systemUserId
  };

  const [user] = existing
    ? await db.update(users).set(values).where(eq(users.id, existing.id)).returning()
    : await db.insert(users).values(values).returning();

  const url = inviteUrl(token);
  const emailSent = await sendInviteEmail({ email, name: user.name, url });

  return { userId: user.id, inviteUrl: url, emailSent } satisfies AuthInviteResult;
}

export async function acceptInvite(input: { token: string; password: string; name?: string }) {
  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const tokenHash = await hashAuthToken(input.token);
  const [user] = await db.select().from(users).where(eq(users.invite_token_hash, tokenHash)).limit(1);

  if (!user || !user.invite_expires_at || user.invite_expires_at.getTime() < Date.now()) {
    throw new Error("Convite invalido ou expirado.");
  }

  const [updated] = await db
    .update(users)
    .set({
      name: input.name?.trim() || user.name,
      password_hash: await hashPassword(input.password),
      password_set_at: new Date(),
      email_verified_at: new Date(),
      invite_token_hash: null,
      invite_expires_at: null,
      updated_at: new Date(),
      modified_by: user.id
    })
    .where(eq(users.id, user.id))
    .returning();

  await createSessionCookie({
    userId: updated.id,
    role: updated.role as Role,
    name: updated.name,
    email: updated.email
  });

  return updated;
}

export async function login(input: { email: string; password: string; remember?: boolean }): Promise<LoginResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(input.email)))
    .limit(1);

  if (!user || user.is_deleted) {
    throw new Error("Email ou senha invalidos.");
  }

  if (!user.password_hash && !user.password_set_at) {
    throw new Error("Acesso inicial pendente. Clique em Criar acesso inicial ou solicite um convite ao administrador.");
  }

  if (!(await verifyPassword(input.password, user.password_hash))) {
    throw new Error("Email ou senha invalidos.");
  }

  if (!user.password_set_at) {
    const token = createAuthToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await db
      .update(users)
      .set({
        invite_token_hash: await hashAuthToken(token),
        invite_expires_at: expiresAt,
        invited_at: now,
        updated_at: now,
        modified_by: user.id
      })
      .where(eq(users.id, user.id));

    return {
      passwordChangeRequired: true,
      passwordChangeUrl: inviteUrl(token),
      user
    };
  }

  await db.update(users).set({ last_login_at: new Date(), updated_at: new Date() }).where(eq(users.id, user.id));

  await createSessionCookie(
    {
      userId: user.id,
      role: user.role as Role,
      name: user.name,
      email: user.email
    },
    input.remember
  );

  return {
    passwordChangeRequired: false,
    user
  };
}
