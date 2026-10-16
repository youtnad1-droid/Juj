import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

export function PanelLayout({ title, nav, children, testId }: { title: string; nav: NavItem[]; children: ReactNode; testId: string }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]" data-testid={testId}>
      <aside className="space-y-3">
        <p className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: !!n.exact }}
              data-testid={`panel-nav-${n.to.split("/").filter(Boolean).join("-")}`}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
              activeProps={{ className: "bg-accent font-semibold text-foreground" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 space-y-6">{children}</section>
    </div>
  );
}

export function StatCard({ label, value, hint, testId }: { label: string; value: ReactNode; hint?: string; testId: string }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold sm:text-3xl">{children}</h1>
      {action}
    </div>
  );
}

export const selectCls = "h-9 rounded-md border bg-background px-2 text-sm";
