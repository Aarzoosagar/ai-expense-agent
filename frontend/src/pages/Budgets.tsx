import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, PiggyBank, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BudgetFormDialog } from "@/components/BudgetFormDialog";
import { BudgetRow, StatusBadge } from "@/components/budget";
import { CategoryIcon, EmptyState, ErrorNote, PageHeader } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { CATEGORIES, OVERALL } from "@/lib/categories";
import { inr, parseISO, todayIST } from "@/lib/format";
import { useBudgetStatus } from "@/lib/queries";
import type { BudgetItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function daysLeftInMonth(): number {
  const t = parseISO(todayIST());
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return last - t.getDate() + 1; // including today
}

export default function Budgets() {
  const qc = useQueryClient();
  const q = useBudgetStatus();
  const [form, setForm] = useState<{ open: boolean; initial: { category: string; amount: number } | null }>({ open: false, initial: null });
  const [removing, setRemoving] = useState<BudgetItem | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/budgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Budget removed");
      setRemoving(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;
  const overall = data?.overall;
  const cats = (data?.items ?? []).filter((i) => !i.is_overall);
  const alerts = (data?.items ?? []).filter((i) => i.status !== "ok");
  const unbudgeted = CATEGORIES.filter((c) => !cats.some((b) => b.category === c));
  const daysLeft = daysLeftInMonth();

  const open = (initial: { category: string; amount: number } | null = null) => setForm({ open: true, initial });

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle={data ? `Monthly limits for ${data.month}` : "Monthly spending limits"}
        actions={<Button onClick={() => open()}><Plus /> Set budget</Button>}
      />

      {q.isError && <ErrorNote error={q.error} retry={() => q.refetch()} />}

      {alerts.length > 0 && (
        <div className="mb-4 space-y-2" role="status">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-up",
                a.status === "over" ? "border-coral/40 bg-coral-soft text-[#B7311F]" : "border-[#F59E0B]/40 bg-warning-soft text-[#9A5400]",
              )}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <b>{a.is_overall ? "Overall budget" : `${a.category} budget`}</b>{" "}
                {a.status === "over"
                  ? `is exceeded — ${inr(Math.abs(a.remaining))} over the ${inr(a.amount)} limit.`
                  : `is ${a.percent.toFixed(0)}% used — only ${inr(a.remaining)} left of ${inr(a.amount)}.`}
              </p>
            </div>
          ))}
        </div>
      )}

      {q.isLoading ? (
        <Skeleton className="h-52 w-full" />
      ) : overall ? (
        <Card className="mb-6 overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <CategoryIcon category={OVERALL} size="lg" className="!bg-navy/5 !text-navy" />
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Overall monthly budget</h2>
                  <div className="mt-1"><StatusBadge item={overall} /></div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4">
                <Figure label="Spent" value={inr(overall.spent)} />
                <Figure label="Budget" value={inr(overall.amount)} />
                <Figure label={overall.remaining < 0 ? "Over by" : "Remaining"} value={inr(Math.abs(overall.remaining))} tone={overall.remaining < 0 ? "bad" : "good"} />
              </div>
              <div className="mt-5">
                <Progress value={overall.percent} status={overall.status} className="h-3" />
                <div className="tabular mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{overall.percent.toFixed(0)}% used</span>
                  <span>{daysLeft} day{daysLeft === 1 ? "" : "s"} left this month</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-muted/70 p-5 md:w-64">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><CalendarDays className="size-3.5" /> Daily allowance</p>
              {overall.remaining > 0 ? (
                <>
                  <p className="tabular text-2xl font-semibold">{inr(Math.floor(overall.remaining / daysLeft))}<span className="text-sm font-normal text-muted-foreground"> / day</span></p>
                  <p className="text-xs text-muted-foreground">to stay within budget for the remaining {daysLeft} day{daysLeft === 1 ? "" : "s"}.</p>
                </>
              ) : (
                <p className="text-sm text-[#B7311F]">You've used up this month's budget.</p>
              )}
              <Button variant="outline" size="sm" onClick={() => open({ category: OVERALL, amount: overall.amount })}>Adjust budget</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <EmptyState icon={PiggyBank} title="Set your overall monthly budget" text="One number for the whole month — we'll show how much is left and warn you before you overspend." action={<Button onClick={() => open()}><Plus /> Set monthly budget</Button>} />
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Category budgets</h2>
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : cats.length === 0 ? (
        <Card><EmptyState icon={PiggyBank} title="No category budgets" text="Limit categories like Food & Dining or Shopping to see exactly where you're overspending." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cats.map((b) => (
            <Card key={b.id} className="p-5 transition-shadow hover:shadow-lift animate-fade-up">
              <BudgetRow item={b} onEdit={() => open({ category: b.category, amount: b.amount })} onDelete={() => setRemoving(b)} />
            </Card>
          ))}
        </div>
      )}

      {unbudgeted.length > 0 && !q.isLoading && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Add a category budget</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unbudgeted.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ open: true, initial: null })}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary hover:bg-accent"
                >
                  <CategoryIcon category={c} size="sm" className="!size-5 !rounded-full" /> {c}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <BudgetFormDialog open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} initial={form.initial} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this budget?"
        confirmLabel="Remove"
        description={removing && <p className="text-sm text-muted-foreground">Your {removing.category} budget of {inr(removing.amount)} will be removed. Past spending isn't affected.</p>}
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-semibold tracking-tight sm:text-2xl", tone === "good" && "text-success", tone === "bad" && "text-[#E5483A]")}>{value}</p>
    </div>
  );
}
