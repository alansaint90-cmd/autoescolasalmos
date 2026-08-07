import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/app/login-form";

function BrandWordmark({ size = "base" }: { size?: "base" | "large" }) {
  return (
    <div className={size === "large" ? "text-[17px] font-black uppercase leading-none tracking-[0.12em]" : "text-[16px] font-black uppercase leading-none tracking-[0.12em]"}>
      <span className="text-slate-50">AUTO </span>
      <span className="bg-gradient-to-b from-[#fde047] via-[#facc15] to-[#b98500] bg-clip-text text-transparent">PRO</span>
      <span className="text-slate-50"> IA</span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#181b22] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(250,204,21,0.055),transparent_25%),radial-gradient(circle_at_72%_44%,rgba(11,95,165,0.08),transparent_30%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1180px] items-center gap-14 px-6 py-10 lg:grid-cols-[1fr_430px]">
        <section className="mx-auto flex w-full max-w-[540px] flex-col items-center justify-center text-center">
          <div className="flex flex-col items-center">
            <BrandLogo size={150} />
            <div className="mt-7">
              <BrandWordmark size="large" />
            </div>
            <p className="mx-auto mt-6 max-w-[470px] text-base leading-7 text-slate-300">
              CRM inteligente para autoescolas.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[430px]">
          <div className="rounded-[24px] border border-slate-500/38 bg-[#181b22]/88 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="mb-10 flex items-center gap-3">
              <BrandLogo size={30} />
              <BrandWordmark />
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-slate-50">Bem-vindo ao Auto Pro</h2>
              <p className="mt-2 text-sm text-slate-400">Acesse seu painel comercial.</p>
            </div>

            <LoginForm />
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            Novo por aqui?{" "}
            <Link href="/dashboard" className="font-black text-primary">
              Acessar demo
            </Link>
          </p>
        </section>
      </div>

      <footer className="absolute inset-x-0 bottom-5 hidden justify-center gap-8 text-xs font-semibold text-slate-500 lg:flex">
        <span>© 2026 Auto Pro IA</span>
        <span>Termos</span>
        <span>Privacidade</span>
      </footer>
    </main>
  );
}
