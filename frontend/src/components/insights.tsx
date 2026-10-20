import { AlertOctagon, AlertTriangle, Info, Sparkles, TrendingDown, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import type { Insight } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLE: Record<Insight["severity"], { icon: LucideIcon; box: string }> = {
  info: { icon: Info, box: "bg-accent text-primary" },
  positive: { icon: TrendingDown, box: "bg-success-soft text-success" },
  warning: { icon: AlertTriangle, box: "bg-warning-soft text-warning" },
  danger: { icon: AlertOctagon, box: "bg-coral-soft text-[#E5483A]" },
};

export function InsightsList({ insights, loading, limit }: { insights?: Insight[]; loading?: boolean; limit?: number }) {
  if (loading)
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  const rows = (insights ?? []).slice(0, limit);
  return (
    <ul className="space-y-4">
      {rows.map((ins, i) => {
        const s = STYLE[ins.severity];
        return (
          <li key={`${ins.kind}-${i}`} className="flex gap-3 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", s.box)}>
              <s.icon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">{ins.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{ins.text}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function InsightsBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
      <Sparkles className="size-3" /> Based on your data
    </span>
  );
}
