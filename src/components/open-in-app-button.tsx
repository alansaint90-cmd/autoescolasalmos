"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type OpenInAppButtonProps = {
  className?: string;
};

export function OpenInAppButton({ className = "" }: OpenInAppButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  async function openApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice.catch(() => null);
      setInstallPrompt(null);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <button
      type="button"
      onClick={() => void openApp()}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-500/16 px-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-cyan-500/22 active:translate-y-0 ${className}`}
      aria-label="Abrir Auto Pro IA no app"
      title="Abrir no app"
    >
      <span className="grid size-5 place-items-center overflow-hidden rounded-md bg-[#061427]">
        <img src="/favicon-32x32.png" alt="" className="size-4" />
      </span>
      <span>Abrir no app</span>
    </button>
  );
}
