"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  KanbanSquare,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/conversas", label: "Conversas", icon: MessageSquareText, badge: 4 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/relatorios", label: "Relatorios", icon: BarChart3 },
  { href: "/analise", label: "Analise", icon: ClipboardList },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings }
];

const SIDEBAR_COLLAPSED_KEY = "auto-pro-ia:sidebar-collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      setIsCollapsed(false);
    }
  }, []);

  function toggleSidebar() {
    setIsCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Ignore storage failures and keep the UI responsive.
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-[linear-gradient(180deg,#060b13,#0b1120)] text-sidebar-foreground shadow-[18px_0_60px_rgba(0,0,0,0.22)] transition-[width] duration-300 md:flex",
        isCollapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className={cn("relative border-b border-sidebar-border py-5", isCollapsed ? "px-3" : "px-5")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between gap-3")}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            className={cn("flex min-w-0 items-center gap-3 text-left", isCollapsed && "justify-center")}
          >
            <BrandLogo size={36} />
            <div className={cn("min-w-0 transition-opacity duration-200", isCollapsed && "hidden")}>
              <div className="text-[16px] font-black uppercase leading-none tracking-[0.12em]">
                <span className="text-slate-50 drop-shadow-[0_0_12px_rgba(249,250,251,0.16)]">AUTO </span>
                <span className="bg-gradient-to-b from-[#fde047] via-[#facc15] to-[#b98500] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(250,204,21,0.18)]">PRO</span>
                <span className="text-slate-50 drop-shadow-[0_0_12px_rgba(249,250,251,0.16)]"> IA</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <nav className={cn("flex-1 space-y-1", isCollapsed ? "p-3" : "p-3")}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          if (isCollapsed) {
            return (
              <div key={item.href} className="group/navitem relative flex justify-center after:absolute after:left-full after:top-0 after:h-full after:w-4 after:content-['']">
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-label={item.label}
                  className={cn(
                    "relative grid size-12 place-items-center overflow-visible rounded-[15px] border transition duration-200",
                    active
                      ? "border-primary/42 bg-[linear-gradient(145deg,rgba(250,204,21,0.16),rgba(250,204,21,0.055))] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_0_1px_rgba(250,204,21,0.06),0_10px_26px_rgba(250,204,21,0.08)]"
                      : "border-white/[0.08] bg-[#0d1522] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-primary/28 hover:bg-[#111b2b] hover:text-primary"
                  )}
                >
                  <Icon className="relative z-10 size-6 transition-transform duration-200 group-hover/navitem:scale-105" strokeWidth={1.9} />
                  {item.badge ? (
                    <span className="absolute -right-1.5 -top-1.5 z-30 grid min-h-4 min-w-4 place-items-center rounded-full border border-[#0B1120] bg-primary px-1 text-[9px] font-black leading-none text-primary-foreground shadow-[0_0_14px_rgba(250,204,21,0.35)]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>

                <Link
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "pointer-events-none absolute left-[calc(100%+4px)] top-1/2 z-[120] flex h-9 min-w-32 -translate-y-1/2 translate-x-2 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-black opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-all duration-200 group-hover/navitem:pointer-events-auto group-hover/navitem:translate-x-0 group-hover/navitem:opacity-100",
                    active
                      ? "border-primary/30 bg-[#111827]/96 text-primary"
                      : "border-white/10 bg-[#0b1120]/96 text-foreground hover:border-primary/30 hover:bg-[#111827]"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-md bg-[#0B1120]/18 px-1.5 py-0.5 text-[10px] font-black">{item.badge}</span>
                  ) : null}
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm transition duration-200",
                active
                  ? "border-primary/38 bg-[linear-gradient(145deg,rgba(250,204,21,0.14),rgba(250,204,21,0.045))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_14px_34px_rgba(0,0,0,0.18)]"
                  : "border-transparent text-muted-foreground hover:border-white/[0.10] hover:bg-white/[0.045] hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "relative z-10 grid shrink-0 place-items-center rounded-[12px] border transition duration-200",
                  "size-8",
                  active
                    ? "border-primary/42 bg-primary/[0.12] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                    : "border-white/[0.08] bg-[#0d1522] text-slate-400 group-hover:border-primary/28 group-hover:bg-primary/10 group-hover:text-primary"
                )}
              >
                <Icon className="size-[17px] transition-transform duration-200 group-hover:scale-105" strokeWidth={1.9} />
              </span>
              <span className="relative z-10 flex-1 font-medium">{item.label}</span>
              {item.badge ? (
                <span
                  className={cn("relative z-10 rounded-md px-1.5 py-0.5 text-[10px] font-bold", active ? "bg-primary/18 text-primary" : "bg-primary text-primary-foreground")}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
