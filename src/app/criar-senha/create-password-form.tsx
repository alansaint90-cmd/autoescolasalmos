"use client";

import { useState } from "react";
import { LockKeyhole, UserRound } from "lucide-react";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  throw new Error(
    text.trim().startsWith("<!DOCTYPE")
      ? "A rota de criacao de senha retornou uma pagina HTML. Reinicie o servidor local e tente novamente."
      : text || "Resposta invalida do servidor."
  );
}

export function CreatePasswordForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("Token de convite ausente.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name || undefined })
      });
      const payload = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel criar a senha.");
      }

      window.location.href = "/dashboard";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel criar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-7 space-y-5" onSubmit={submit}>
      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Nome</span>
        <span className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4">
          <UserRound className="size-4 text-muted-foreground" />
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Senha</span>
        <span className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4">
          <LockKeyhole className="size-4 text-muted-foreground" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo 8 caracteres"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Confirmar senha</span>
        <span className="flex h-13 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4">
          <LockKeyhole className="size-4 text-muted-foreground" />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Digite novamente"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
          />
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold leading-6 text-primary">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-primary text-sm font-black text-primary-foreground shadow-[0_18px_44px_rgba(250,204,21,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Criando..." : "Criar senha e entrar"}
      </button>
    </form>
  );
}
