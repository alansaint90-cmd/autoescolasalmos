"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
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

type CrmNotification = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export function AppSidebar() {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    } catch {
      // Ignore storage failures and keep the hover menu responsive.
    }
  }, []);

  const isExpanded = isHovered;
  const unreadCount = notifications.filter((notification) => notification.status !== "read").length;

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setNotificationsLoading(true);
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar notificacoes.");
        const data = await response.json();
        if (active) setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch {
        if (active) setNotifications([]);
      } finally {
        if (active) setNotificationsLoading(false);
      }
    }

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-[linear-gradient(180deg,#060b13,#0b1120)] text-sidebar-foreground shadow-[18px_0_60px_rgba(0,0,0,0.22)] transition-[width] duration-300 md:flex",
        isExpanded ? "w-64" : "w-[76px]"
      )}
    >
      <div className={cn("relative border-b border-sidebar-border py-5", isExpanded ? "px-5" : "px-3")}>
        <div className={cn("flex", isExpanded ? "flex-col items-start gap-4" : "items-center justify-center")}>
          <div className={cn("flex min-w-0", isExpanded ? "flex-col items-start gap-2" : "flex-col items-center gap-4")}>
            <Link
              href="/dashboard"
              prefetch={false}
              aria-label="Auto Pro IA"
              className={cn("flex min-w-0 text-left", isExpanded ? "flex-col items-start gap-3" : "items-center justify-center")}
            >
              <BrandLogo size={isExpanded ? 62 : 36} />
              <div className={cn("min-w-0 transition-opacity duration-200", !isExpanded && "hidden")}>
                <div className="text-[18px] font-black uppercase leading-[0.94] tracking-[0.16em]">
                  <div className="text-slate-50 drop-shadow-[0_0_12px_rgba(249,250,251,0.16)]">AUTO</div>
                  <div>
                    <span className="bg-gradient-to-b from-[#fde047] via-[#facc15] to-[#b98500] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(250,204,21,0.18)]">PRO</span>
                    <span className="text-slate-50 drop-shadow-[0_0_12px_rgba(249,250,251,0.16)]"> IA</span>
                  </div>
                </div>
              </div>
            </Link>
            {!isExpanded ? (
              <NotificationButton
                compact
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notificationsLoading}
                open={notificationsOpen}
                onOpenChange={setNotificationsOpen}
              />
            ) : null}
          </div>
          {isExpanded ? (
            <NotificationButton
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationsLoading}
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
            />
          ) : null}
        </div>
      </div>

      <nav className={cn("flex-1 space-y-3", isExpanded ? "p-3" : "p-3")}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          if (!isExpanded) {
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
                  <Icon className="relative z-10 size-6 transition-transform duration-200 group-hover/navitem:scale-105" strokeWidth={1.85} />
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
                <Icon className="size-[18px] transition-transform duration-200 group-hover:scale-105" strokeWidth={1.85} />
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

function NotificationButton({
  compact = false,
  notifications,
  unreadCount,
  loading,
  open,
  onOpenChange
}: {
  compact?: boolean;
  notifications: CrmNotification[];
  unreadCount: number;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div
      className={cn("group/notifications relative", compact ? "self-center" : "w-full")}
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <button
        type="button"
        aria-label="Notificacoes"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "relative text-slate-300 transition duration-200 hover:text-primary",
          compact
            ? "grid size-12 place-items-center rounded-[15px] border border-white/[0.08] bg-[#0d1522] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-primary/24 hover:bg-[#111b2b]"
            : "flex w-full items-center gap-3 rounded-xl bg-transparent py-2 text-sm text-muted-foreground hover:bg-white/[0.025] hover:text-foreground"
        )}
      >
        <Bell className={cn(compact ? "size-6" : "size-5", "transition duration-200")} strokeWidth={1.85} />
        {!compact ? <span className="relative z-10 flex-1 text-left font-medium">Notificacoes</span> : null}
        {unreadCount > 0 ? (
          <span
            className={cn(
              "grid place-items-center rounded-full bg-primary font-black text-primary-foreground shadow-[0_0_10px_rgba(250,204,21,0.35)]",
              compact
                ? "absolute -right-1 -top-1 min-h-4 min-w-4 px-1 text-[9px]"
                : "min-h-5 min-w-5 px-1.5 text-[10px]"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          <span className={cn("rounded-full bg-primary shadow-[0_0_12px_rgba(250,204,21,0.8)]", compact ? "absolute right-2.5 top-2.5 size-2" : "size-2")} />
        )}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute top-0 z-[180] w-72 rounded-2xl border border-white/[0.07] bg-[#070d18]/[0.99] p-2.5 text-left shadow-[0_22px_54px_rgba(0,0,0,0.48)] backdrop-blur-2xl",
            compact ? "left-[calc(100%+12px)]" : "left-full ml-3"
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <h3 className="text-sm font-black text-foreground">Notificacoes</h3>
              <p className="text-[10px] font-semibold text-muted-foreground">Eventos comerciais do CRM</p>
            </div>
            <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground">
              {unreadCount}
            </span>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {loading ? (
              <div className="rounded-xl bg-white/[0.035] p-3 text-xs font-semibold text-muted-foreground">
                Carregando notificacoes...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl bg-white/[0.035] p-3 text-xs font-semibold text-muted-foreground">
                Nenhuma notificacao registrada ainda.
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({ notification }: { notification: CrmNotification }) {
  const isUnread = notification.status !== "read";
  const label = getNotificationLabel(notification.type);

  return (
    <div className="rounded-xl bg-[#0d1523] p-3 transition duration-200 hover:bg-[#101b2d]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]", label.className)}>
          {label.text}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">{formatNotificationTime(notification.createdAt)}</span>
      </div>
      <p className="line-clamp-1 text-xs font-black text-foreground">{notification.title}</p>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-relaxed text-muted-foreground">{notification.description}</p>
      {isUnread ? <span className="mt-2 block h-0.5 w-7 rounded-full bg-primary/90" /> : null}
    </div>
  );
}

function getNotificationLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("payment")) return { text: "Venda", className: "bg-emerald-400/12 text-emerald-300" };
  if (normalized.includes("purchase")) return { text: "Intencao", className: "bg-primary/12 text-primary" };
  if (normalized.includes("human")) return { text: "Humano", className: "bg-sky-400/12 text-sky-300" };
  if (normalized.includes("pending")) return { text: "Pendente", className: "bg-amber-400/12 text-amber-300" };
  return { text: "CRM", className: "bg-slate-400/12 text-slate-300" };
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
