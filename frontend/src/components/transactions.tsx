import { CategoryIcon } from "@/components/common";
import { inr, relativeDay } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TransactionRow({ e, showId, className }: { e: Expense; showId?: boolean; className?: string }) {
  return (
    <li className={cn("flex items-center gap-3 py-2.5", className)}>
      <CategoryIcon category={e.category} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.description || e.category}</p>
        <p className="truncate text-xs text-muted-foreground">
          {e.category} · {relativeDay(e.expense_date)}
          {showId && <span className="ml-1.5 opacity-60">#{e.id}</span>}
        </p>
      </div>
      <p className="tabular text-sm font-semibold">{inr(e.amount)}</p>
    </li>
  );
}
