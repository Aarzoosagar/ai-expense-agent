import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

export function CategoryIcon({ category, size = "md", className }: { category: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const { icon: Icon, color } = categoryMeta(category);
  const box = size === "sm" ? "size-8 rounded-lg" : size === "lg" ? "size-12 rounded-xl" : "size-10 rounded-xl";
  const ico = size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-[18px]";
  return (
    <span className={cn("grid shrink-0 place-items-center", box, className)} style={{ backgroundColor: `${color}1A`, color }} aria-hidden>
      <Icon className={ico} strokeWidth={2} />
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  footer,
  loading,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: "primary" | "success" | "coral" | "amber" | "navy";
  footer?: ReactNode;
  loading?: boolean;
}) {
  const tones = {
    primary: "bg-accent text-primary",
    success: "bg-success-soft text-success",
    coral: "bg-coral-soft text-[#E5483A]",
    amber: "bg-warning-soft text-warning",
    navy: "bg-navy/5 text-navy",
  };
  return (
    <Card className="p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid size-9 place-items-center rounded-lg", tones[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-32" />
      ) : (
        <div className="tabular mt-2 text-[26px] font-semibold leading-none tracking-tight">{value}</div>
      )}
      <div className="mt-3 min-h-5 text-xs text-muted-foreground">{loading ? <Skeleton className="h-4 w-24" /> : footer}</div>
    </Card>
  );
}

export function Delta({ percent, inverse = true }: { percent: number | null | undefined; inverse?: boolean }) {
  if (percent === null || percent === undefined) return <span className="text-muted-foreground">no earlier data to compare</span>;
  const up = percent > 0;
  const bad = inverse ? up : !up; // for spending, going up is "bad"
  const Icon = up ? TrendingUp : TrendingDown;
  if (percent === 0) return <span className="text-muted-foreground">same as before</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", bad ? "text-[#E5483A]" : "text-success")}>
      <Icon className="size-3.5" />
      {Math.abs(percent).toFixed(0)}% {up ? "higher" : "lower"}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-up">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="rounded-lg border border-coral/30 bg-coral-soft px-4 py-3 text-sm text-[#B7311F]">
      {msg}{" "}
      {retry && (
        <button onClick={retry} className="font-medium underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  );
}
