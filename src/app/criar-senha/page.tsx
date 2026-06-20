import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CreatePasswordForm } from "@/app/criar-senha/create-password-form";

export default async function CreatePasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#05070d] px-6 py-10 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(250,204,21,0.10),transparent_34%),radial-gradient(circle_at_70%_80%,rgba(11,95,165,0.16),transparent_38%)]" />
      <section className="relative w-full max-w-lg rounded-[26px] border border-border bg-card/82 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo size={34} />
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em]">Auto Pro IA</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Acesso seguro</p>
          </div>
        </div>

        <h1 className="text-3xl font-black tracking-tight">Crie ou redefina sua senha</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Defina uma senha para acessar o painel. O link expira por seguranca.
        </p>

        <CreatePasswordForm token={token} />

        <Link href="/" className="mt-6 block text-center text-sm font-bold text-primary">
          Voltar para o login
        </Link>
      </section>
    </main>
  );
}
