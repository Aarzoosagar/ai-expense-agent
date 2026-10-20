import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Check, CheckCircle2, HelpCircle, PencilLine, PiggyBank, Trash2, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BudgetRow } from "@/components/budget";
import { CategoryDonut, CategoryLegend } from "@/components/charts";
import { CategoryIcon } from "@/components/common";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { TransactionRow } from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { categoryMeta } from "@/lib/categories";
import { fmtDate, inr, pctText } from "@/lib/format";
import type { Block, Expense } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface BlockCtx {
  onSend: (text: string) => void;
  onAction: (a: { type: "confirm_delete" | "cancel_delete"; expense_id: number }) => void;
  isLatest: boolean;
  busy: boolean;
}

function Shell({ tone = "neutral", icon, title, children, className }: { tone?: "neutral" | "success" | "danger" | "primary"; icon?: ReactNode; title?: string; children: ReactNode; className?: string }) {
  const head = { neutral: "text-muted-foreground", success: "text-success", danger: "text-[#E5483A]", primary: "text-primary" }[tone];
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-card animate-fade-up", className)}>
      {title && (
        <div className={cn("flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide", head)}>
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function SavedCard({ b }: { b: Extract<Block, { type: "expense_saved" }> }) {
  const qc = useQueryClient();
  const [undone, setUndone] = useState(false);
  const [editing, setEditing] = useState(false);
  const e = b.expense;
  const undo = useMutation({
    mutationFn: () => api.del(`/expenses/${e.id}`),
    onSuccess: () => {
      setUndone(true);
      qc.invalidateQueries();
      toast.success("Expense removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const bud = b.budget;
  return (
    <Shell tone="success" icon={<CheckCircle2 className="size-4" />} title={undone ? "Expense removed" : "Expense saved"}>
      <div className={cn("p-4", undone && "opacity-50")}>
        <div className="flex items-center gap-3">
          <CategoryIcon category={e.category} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="tabular text-2xl font-semibold tracking-tight">{inr(e.amount)}</p>
            <p className="truncate text-sm text-muted-foreground">
              {e.description || e.category} · {e.category} · {fmtDate(e.expense_date, true)}
            </p>
          </div>
        </div>
        {!undone && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-muted-foreground">{e.category} · {b.month}</p>
                <p className="tabular mt-0.5 text-sm font-semibold">{inr(b.category_month_total)}</p>
              </div>
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-muted-foreground">All spending · {b.month}</p>
                <p className="tabular mt-0.5 text-sm font-semibold">{inr(b.month_total)}</p>
              </div>
            </div>
            {bud && bud.status !== "ok" && (
              <p className={cn("mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs", bud.status === "over" ? "bg-coral-soft text-[#B7311F]" : "bg-warning-soft text-[#9A5400]")}>
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {bud.is_overall ? "Monthly budget" : `${bud.category} budget`}: {bud.status === "over" ? `${inr(Math.abs(bud.remaining))} over the ${inr(bud.amount)} limit` : `${bud.percent.toFixed(0)}% used, ${inr(bud.remaining)} left`}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><PencilLine /> Edit</Button>
              <Button variant="ghost" size="sm" disabled={undo.isPending} onClick={() => undo.mutate()}><Undo2 /> Undo</Button>
            </div>
          </>
        )}
      </div>
      <ExpenseFormDialog open={editing} onOpenChange={setEditing} expense={e} />
    </Shell>
  );
}

function Diff({ label, from, to }: { label: string; from: string; to: string }) {
  if (from === to) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <span className="text-muted-foreground line-through">{from}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" />
      <span className="font-medium">{to}</span>
    </div>
  );
}

function UpdatedCard({ b }: { b: Extract<Block, { type: "expense_updated" }> }) {
  const { before, after } = b;
  return (
    <Shell tone="primary" icon={<PencilLine className="size-4" />} title="Expense updated">
      <div className="space-y-2 p-4">
        <TxLine e={after} />
        <div className="space-y-1.5 pt-1">
          <Diff label="Amount" from={inr(before.amount)} to={inr(after.amount)} />
          <Diff label="Category" from={before.category} to={after.category} />
          <Diff label="Description" from={before.description || "—"} to={after.description || "—"} />
          <Diff label="Date" from={fmtDate(before.expense_date, true)} to={fmtDate(after.expense_date, true)} />
        </div>
      </div>
    </Shell>
  );
}

function TxLine({ e }: { e: Expense }) {
  return (
    <ul>
      <TransactionRow e={e} showId />
    </ul>
  );
}

function ListCard({ b }: { b: Extract<Block, { type: "expense_list" }> }) {
  return (
    <Shell title={b.title}>
      {b.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matching expenses.</p>
      ) : (
        <ul className="divide-y px-4">
          {b.items.map((e) => (
            <TransactionRow key={e.id} e={e} showId />
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <span>{b.count > b.shown ? `Showing ${b.shown} of ${b.count}` : `${b.count} transaction${b.count === 1 ? "" : "s"}`}</span>
        <span>
          Total <b className="tabular text-sm text-foreground">{inr(b.total)}</b>
        </span>
      </div>
    </Shell>
  );
}

function SummaryCard({ b }: { b: Extract<Block, { type: "spending_summary" }> }) {
  const s = b.summary;
  return (
    <Shell title={`${s.category ? `${s.category} · ` : ""}${s.range.label}`} icon={<Wallet className="size-4" />}>
      <div className="p-4">
        <p className="tabular text-3xl font-semibold tracking-tight">{inr(s.total)}</p>
        <p className="text-sm text-muted-foreground">across {s.count} transaction{s.count === 1 ? "" : "s"}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-muted-foreground">Avg per transaction</p>
            <p className="tabular mt-0.5 text-sm font-semibold">{inr(s.average_transaction)}</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-muted-foreground">Avg per day</p>
            <p className="tabular mt-0.5 text-sm font-semibold">{inr(s.average_daily)}</p>
          </div>
        </div>
        {b.categories.length > 0 && (
          <div className="mt-5 grid items-center gap-4 sm:grid-cols-[150px_1fr]">
            <CategoryDonut data={b.categories} height={150} centerLabel="Total" />
            <CategoryLegend data={b.categories} limit={5} />
          </div>
        )}
      </div>
    </Shell>
  );
}

function TopCategoryCard({ b }: { b: Extract<Block, { type: "top_category" }> }) {
  if (!b.top)
    return (
      <Shell title={b.range.label}>
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No spending in this period.</p>
      </Shell>
    );
  const max = b.categories[0].total;
  return (
    <Shell title={`Top category · ${b.range.label}`}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <CategoryIcon category={b.top.category} size="lg" />
          <div>
            <p className="text-lg font-semibold">{b.top.category}</p>
            <p className="tabular text-sm text-muted-foreground">
              {inr(b.top.total)} · {b.top.percent.toFixed(0)}% of spending
            </p>
          </div>
        </div>
        <ul className="mt-4 space-y-2.5">
          {b.categories.slice(0, 5).map((c) => (
            <li key={c.category} className="text-xs">
              <div className="mb-1 flex justify-between">
                <span>{c.category}</span>
                <span className="tabular font-medium">{inr(c.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.total / max) * 100}%`, background: categoryMeta(c.category).color }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

function ComparisonCard({ b }: { b: Extract<Block, { type: "comparison" }> }) {
  const c = b.data;
  const up = c.direction === "up";
  return (
    <Shell title={`${c.a.range.label} vs ${c.b.range.label}${c.category ? ` · ${c.category}` : ""}`}>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-accent/70 p-3">
            <p className="text-xs text-muted-foreground">{c.a.range.label}</p>
            <p className="tabular mt-1 text-xl font-semibold">{inr(c.a.total)}</p>
          </div>
          <div className="rounded-xl bg-muted/70 p-3">
            <p className="text-xs text-muted-foreground">{c.b.range.label}</p>
            <p className="tabular mt-1 text-xl font-semibold">{inr(c.b.total)}</p>
          </div>
        </div>
        <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-semibold", c.direction === "flat" ? "text-muted-foreground" : up ? "text-[#E5483A]" : "text-success")}>
          {c.direction === "flat" ? (
            "No change"
          ) : (
            <>
              {up ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              {inr(Math.abs(c.difference))} {up ? "more" : "less"} {c.percent_change !== null && <span className="font-normal text-muted-foreground">({pctText(c.percent_change)})</span>}
            </>
          )}
        </p>
        {!c.category && c.categories.length > 0 && (
          <ul className="mt-3 space-y-2 border-t pt-3">
            {c.categories.slice(0, 4).map((d) => (
              <li key={d.category} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ background: categoryMeta(d.category).color }} />
                <span className="flex-1 truncate">{d.category}</span>
                <span className="tabular text-muted-foreground">{inr(d.b)} → {inr(d.a)}</span>
                <span className={cn("tabular w-16 text-right font-semibold", d.difference > 0 ? "text-[#E5483A]" : d.difference < 0 ? "text-success" : "text-muted-foreground")}>
                  {d.difference > 0 ? "+" : d.difference < 0 ? "−" : ""}{inr(Math.abs(d.difference))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function BudgetCard({ b }: { b: Extract<Block, { type: "budget_status" }> }) {
  const title = b.action === "set" ? (b.created ? "Budget created" : "Budget updated") : b.action === "delete" ? "Budget removed" : `Budgets · ${b.month}`;
  const items = b.action === "set" && b.focus ? b.items.filter((i) => (i.is_overall ? "Overall" : i.category) === b.focus) : b.items;
  return (
    <Shell tone={b.action === "get" ? "neutral" : "success"} icon={b.action === "get" ? <PiggyBank className="size-4" /> : <CheckCircle2 className="size-4" />} title={title}>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{b.action === "delete" ? `${b.focus} budget removed.` : "No budgets set yet. Try “Set my monthly budget to ₹30,000”."}</p>
      ) : (
        <div className="space-y-5 p-4">
          {items.map((i) => (
            <BudgetRow key={i.id} item={i} />
          ))}
        </div>
      )}
    </Shell>
  );
}

function ClarificationCard({ b, ctx }: { b: Extract<Block, { type: "clarification" }>; ctx: BlockCtx }) {
  const [picked, setPicked] = useState<string | null>(null);
  const locked = !ctx.isLatest || picked !== null || ctx.busy;
  return (
    <Shell tone="primary" icon={<HelpCircle className="size-4" />} title="Quick question">
      <div className="p-4">
        <p className="text-sm font-medium">{b.question}</p>
        {b.options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {b.options.map((o) => (
              <button
                key={o}
                disabled={locked}
                onClick={() => {
                  setPicked(o);
                  ctx.onSend(o);
                }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                  picked === o ? "border-primary bg-primary text-white" : "bg-card hover:border-primary hover:bg-accent disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card",
                )}
              >
                {picked === o && <Check className="mr-1 inline size-3.5" />}
                {o}
              </button>
            ))}
          </div>
        )}
        {ctx.isLatest && b.options.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Type your answer below.</p>}
      </div>
    </Shell>
  );
}

function ConfirmDeleteCard({ b, ctx }: { b: Extract<Block, { type: "confirm_delete" }>; ctx: BlockCtx }) {
  const [choice, setChoice] = useState<"confirm" | "cancel" | null>(null);
  const locked = !ctx.isLatest || choice !== null || ctx.busy;
  return (
    <Shell tone="danger" icon={<Trash2 className="size-4" />} title="Confirm deletion">
      <div className="p-4">
        <TxLine e={b.expense} />
        <p className="mt-1 text-xs text-muted-foreground">This permanently removes the expense and can't be undone.</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={locked}
            onClick={() => {
              setChoice("confirm");
              ctx.onAction({ type: "confirm_delete", expense_id: b.expense.id });
            }}
          >
            <Trash2 /> Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={() => {
              setChoice("cancel");
              ctx.onAction({ type: "cancel_delete", expense_id: b.expense.id });
            }}
          >
            Keep it
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function BlockView({ block, ctx }: { block: Block; ctx: BlockCtx }) {
  switch (block.type) {
    case "expense_saved":
      return <SavedCard b={block} />;
    case "expense_updated":
      return <UpdatedCard b={block} />;
    case "expense_deleted":
      return (
        <Shell tone="success" icon={<CheckCircle2 className="size-4" />} title="Expense deleted">
          <div className="px-4 opacity-70">
            <TxLine e={block.expense} />
          </div>
        </Shell>
      );
    case "expense_list":
      return <ListCard b={block} />;
    case "spending_summary":
      return <SummaryCard b={block} />;
    case "top_category":
      return <TopCategoryCard b={block} />;
    case "comparison":
      return <ComparisonCard b={block} />;
    case "budget_status":
      return <BudgetCard b={block} />;
    case "clarification":
      return <ClarificationCard b={block} ctx={ctx} />;
    case "confirm_delete":
      return <ConfirmDeleteCard b={block} ctx={ctx} />;
    case "error":
      return (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-coral/40 bg-coral-soft px-4 py-3 text-sm text-[#B7311F] animate-fade-up">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {block.message}
        </div>
      );
  }
}
