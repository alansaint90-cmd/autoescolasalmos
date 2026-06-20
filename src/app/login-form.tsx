"use client";

import { useState } from "react";
import { LockKeyhole, Mail, X } from "lucide-react";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  throw new Error(
    text.trim().startsWith("<!DOCTYPE")
      ? "A rota de autenticacao retornou uma pagina HTML. Reinicie o servidor local e confirme se a API esta ativa."
      : text || "Resposta invalida do servidor."
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("admin@autopro.ia");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [firstAccessUrl, setFirstAccessUrl] = useState("");
  const [recoverySecret, setRecoverySecret] = useState("");
  const [showRecoverySecret, setShowRecoverySecret] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFirstAccessUrl("");

    if (!email.trim() || !password.trim()) {
      setError("Informe o email e a senha para entrar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember })
      });
      const payload = await readJsonResponse<{
        error?: string;
        passwordChangeRequired?: boolean;
        passwordChangeUrl?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel entrar.");
      }

      if (payload.passwordChangeRequired) {
        window.location.href = payload.passwordChangeUrl || "/criar-senha";
        return;
      }

      window.location.href = "/dashboard";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function prepareSuperAdmin() {
    setError("");
    setFirstAccessUrl("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/bootstrap", { method: "POST" });
      const payload = await readJsonResponse<{
        error?: string;
        inviteUrl?: string;
        emailSent?: boolean;
        user?: {
          firstAccessRequired?: boolean;
          passwordReady?: boolean;
        };
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel preparar o superadmin.");
      }

      if (payload.inviteUrl) {
        setFirstAccessUrl(payload.inviteUrl);
        setError(
          payload.emailSent
            ? "Link de primeiro acesso enviado por email. Voce tambem pode abrir pelo botao abaixo."
            : "Link de primeiro acesso gerado. Abra pelo botao abaixo para criar sua senha."
        );
        return;
      }

      setError(
        payload.user?.passwordReady
          ? "Superadmin ja possui senha criada. Use email e senha para entrar."
          : "Superadmin preparado. Tente entrar com a senha temporaria para criar a senha definitiva."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel preparar o superadmin.");
    } finally {
      setLoading(false);
    }
  }

  async function recoverSuperAdmin() {
    setError("");
    setFirstAccessUrl("");

    if (!email.trim()) {
      setError("Informe o email do Superadmin para recuperar o acesso.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover-superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recoverySecret: recoverySecret || undefined })
      });
      const payload = await readJsonResponse<{
        error?: string;
        message?: string;
        inviteUrl?: string;
        emailSent?: boolean;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel recuperar o acesso.");
      }

      if (payload.inviteUrl) {
        setFirstAccessUrl(payload.inviteUrl);
      }

      setError(payload.message || "Recuperacao solicitada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel recuperar o acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    setError("");
    setFirstAccessUrl("");

    if (!email.trim()) {
      setError("Informe seu email para recuperar a senha.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await readJsonResponse<{
        error?: string;
        message?: string;
        resetUrl?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel solicitar recuperacao.");
      }

      if (payload.resetUrl) {
        setFirstAccessUrl(payload.resetUrl);
      }

      setError(payload.message || "Se este email estiver cadastrado, enviaremos um link de recuperacao.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel solicitar recuperacao.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-7" onSubmit={submit}>
      <label className="block">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Email
        </span>
        <span className="flex h-14 items-center gap-4 rounded-[18px] border border-border bg-input/55 px-4 transition focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
          <Mail className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none"
            aria-label="Email"
            required
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Senha
        </span>
        <span className="flex h-14 items-center gap-4 rounded-[18px] border border-border bg-input/55 px-4 transition focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
          <LockKeyhole className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none"
            aria-label="Senha"
            required
          />
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-4 rounded border-border accent-primary"
            aria-label="Manter conectado"
          />
          <span>Manter conectado</span>
        </label>
        <button type="button" className="font-semibold text-primary transition hover:text-primary/80" onClick={() => setShowRecoveryModal(true)}>
          Recuperar acesso
        </button>
      </div>

      {error ? (
        <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold leading-6 text-primary">
          <p>{error}</p>
          {firstAccessUrl ? (
            <a
              href={firstAccessUrl}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black uppercase tracking-[0.08em] text-primary-foreground transition hover:brightness-105"
            >
              Abrir link de senha
            </a>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex h-14 w-full items-center justify-center rounded-[20px] bg-primary px-5 text-base font-extrabold text-primary-foreground shadow-[0_18px_44px_oklch(0.86_0.17_95_/_0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Validando..." : "Entrar no painel"}
      </button>

      {showRecoveryModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05080d]/78 p-5 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-[#111827] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Acesso ao painel</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-foreground">Recuperar acesso</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Escolha a melhor opcao para recuperar senha, criar primeiro acesso ou restaurar o Superadmin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-border bg-white/[0.04] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                aria-label="Fechar recuperacao de acesso"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                disabled={loading}
                className="flex min-h-12 items-center justify-between rounded-[16px] border border-border bg-white/[0.035] px-4 text-left text-sm font-extrabold text-foreground transition hover:border-primary/35 hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={requestPasswordReset}
              >
                <span>Esqueci minha senha</span>
                <span className="text-xs font-semibold text-muted-foreground">Enviar link</span>
              </button>
              <button
                type="button"
                disabled={loading}
                className="flex min-h-12 items-center justify-between rounded-[16px] border border-border bg-white/[0.035] px-4 text-left text-sm font-extrabold text-foreground transition hover:border-primary/35 hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={prepareSuperAdmin}
              >
                <span>Criar acesso inicial</span>
                <span className="text-xs font-semibold text-muted-foreground">Primeiro uso</span>
              </button>
              <button
                type="button"
                disabled={loading}
                className="flex min-h-12 items-center justify-between rounded-[16px] border border-primary/28 bg-primary/[0.10] px-4 text-left text-sm font-extrabold text-primary transition hover:border-primary/50 hover:bg-primary/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={recoverSuperAdmin}
              >
                <span>Recuperar Superadmin</span>
                <span className="text-xs font-semibold text-primary/80">Emergencia</span>
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                className="text-xs font-bold text-muted-foreground transition hover:text-primary"
                onClick={() => setShowRecoverySecret((current) => !current)}
              >
                {showRecoverySecret ? "Ocultar codigo de recuperacao" : "Tenho codigo de recuperacao"}
              </button>
              {showRecoverySecret ? (
                <span className="flex h-11 items-center rounded-[16px] border border-border bg-input/45 px-4 transition focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10">
                  <input
                    type="password"
                    value={recoverySecret}
                    onChange={(event) => setRecoverySecret(event.target.value)}
                    placeholder="Codigo configurado em AUTH_RECOVERY_SECRET"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
                    aria-label="Codigo de recuperacao"
                  />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
