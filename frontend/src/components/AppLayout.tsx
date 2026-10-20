import { BarChart3, LayoutDashboard, LogOut, Menu, MessageSquareText, PiggyBank, Plus, Receipt, Settings as SettingsIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuickAdd } from "@/lib/quickadd";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/chat", label: "AI Chat", icon: MessageSquareText },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary shadow-lift">
        <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 22V13.5L16 8l9 5.5V22" />
          <circle cx="16" cy="17" r="2.4" fill="#fff" stroke="none" />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight text-white">Expense Agent</p>
        <p className="text-[11px] text-white/50">AI personal finance</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { openAdd } = useQuickAdd();
  const initials = (user?.name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="px-2">
        <Logo />
      </div>
      <Button
        className="mt-7 w-full justify-start gap-2.5 shadow-lift"
        onClick={() => {
          onNavigate?.();
          openAdd();
        }}
      >
        <Plus /> Add expense
      </Button>
      <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("size-[18px] transition-colors", isActive ? "text-[#A99BFB]" : "")} />
                {label}
                {isActive && <span className="ml-auto size-1.5 rounded-full bg-[#A99BFB]" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/30 text-xs font-semibold text-white">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-[11px] text-white/50">{user?.email}</p>
        </div>
        <button onClick={logout} aria-label="Sign out" className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { openAdd } = useQuickAdd();
  const isChat = pathname.startsWith("/chat");

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <SidebarContent />
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-navy px-4 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-white/80 hover:bg-white/10">
          <Menu className="size-5" />
        </button>
        <p className="text-[15px] font-semibold text-white">Expense Agent</p>
        <button onClick={openAdd} aria-label="Add expense" className="grid size-9 place-items-center rounded-lg bg-primary text-white">
          <Plus className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy/60 animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-navy animate-slide-in">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1.5 text-white/70 hover:bg-white/10">
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        {isChat ? (
          <div className="h-[calc(100dvh-3.5rem)] p-0 sm:p-5 lg:h-dvh lg:p-6">
            <Outlet />
          </div>
        ) : (
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
