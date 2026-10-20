import { AlertTriangle, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/misc";
import { inr } from "@/lib/format";
import type { BudgetItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ item }: { item: BudgetItem }) {
  if (item.status === "over") return <Badge tone="danger"><AlertTriangle className="size-3" />Over budget</Badge>;
  if (item.status === "warning") return <Badge tone="warning"><AlertTriangle className="size-3" />Nearing limit</Badge>;
  return <Badge tone="success"><CheckCircle2 className="size-3" />On track</Badge>;
}

export function BudgetRow({
  item,
  compact,
  onEdit,
  onDelete,
}: {
  item: BudgetItem;
  compact?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const over = item.status === "over";
  return (
    <div className="group">
      <div className="mb-2 flex items-center gap-3">
        <CategoryIcon category={item.category} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.is_overall ? "Overall monthly budget" : item.category}</p>
          <p className="tabular text-xs text-muted-foreground">
            {inr(item.spent)} of {inr(item.amount)}
          </p>
        </div>
        {!compact && <StatusBadge item={item} />}
        {compact && (
          <span className={cn("tabular text-xs font-semibold", over ? "text-[#E5483A]" : item.status === "warning" ? "text-warning" : "text-muted-foreground")}>
            {item.percent.toFixed(0)}%
          </span>
        )}
        {onEdit && (
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={`Adjust ${item.category} budget`}>
            <Pencil />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-[#E5483A]" onClick={onDelete} aria-label={`Remove ${item.category} budget`}>
            <Trash2 />
          </Button>
        )}
      </div>
      <Progress value={item.percent} status={item.status} />
      {!compact && (
        <p className={cn("tabular mt-1.5 text-xs", over ? "font-medium text-[#E5483A]" : "text-muted-foreground")}>
          {over ? `${inr(Math.abs(item.remaining))} over the limit` : `${inr(item.remaining)} left`}
        </p>
      )}
    </div>
  );
}
