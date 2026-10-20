import { ArrowRight, CalendarClock, Crown, MessageSquareText, PiggyBank, Plus, Receipt, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BudgetFormDialog } from "@/components/BudgetFormDialog";
import { BudgetRow } from "@/components/budget";
import { CategoryDonut, CategoryLegend, TrendChart } from "@/components/charts";
import { Delta, EmptyState, ErrorNote, PageHeader, StatCard } from "@/components/common";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { InsightsBadge, InsightsList } from "@/components/insights";
import { TransactionRow } from "@/components/transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { greeting } from "@/lib/format";
import { granularityFor, useBreakdown, useBudgetStatus, useInsights, useRecent, useSummary, useTrend } from "@/lib/queries";
import { useQuickAdd } from "@/lib/quickadd";
import { DEFAULT_RANGE, type RangeSel } from "@/lib/range";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { openAdd } = useQuickAdd();
  const [range, setRange] = useState<RangeSel>(DEFAULT_RANGE);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const summary = useSummary(range);
  const breakdown = useBreakdown(range);
  const trend = useTrend(range, granularityFor(summary.data?.range.days));
  const recent = useRecent(range, 6);
  const budgets = useBudgetStatus();
  const insights = useInsights();

  const s = summary.data;
  const overall = budgets.data?.overall;
  const empty = !!s && s.count === 0;
  const catBudgets = (budgets.data?.items ?? []).filter((i) => !i.is_overall);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user?.name.split(" ")[0] ?? "there"}`}
        subtitle="Here's where your money is going."
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Button onClick={openAdd} className="hidden sm:inline-flex">
              <Plus /> Quick add
            </Button>
          </>
        }
      />

      {summary.isError && <ErrorNote error={summary.error} retry={() => summary.refetch()} />}
      {budgets.isError && <ErrorNote error={budgets.error} retry={() => budgets.refetch()} />}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Spent · ${s?.range.label ?? "…"}`}
          icon={Wallet}
          loading={!s}
          value={s && inr(s.total)}
          footer={s && <><Delta percent={s.change_percent} /> <span className="text-muted-foreground">vs {s.previous.range.label.toLowerCase()}</span></>}
        />
        <StatCard
          label="Monthly budget"
          icon={PiggyBank}
          tone="navy"
          loading={budgets.isLoading}
          value={budgets.isError ? <span className="text-lg text-muted-foreground">Unavailable</span> : overall ? inr(overall.amount) : <span className="text-lg text-muted-foreground">Not set</span>}
          footer={
            budgets.isError ? (
              <span className="text-[#B7311F]">Couldn't load budget</span>
            ) : overall ? (
              <span className={cn("font-medium", overall.status === "over" ? "text-[#E5483A]" : "text-success")}>
                {overall.status === "over" ? `${inr(Math.abs(overall.remaining))} over budget` : `${inr(overall.remaining)} remaining`}
              </span>
            ) : (
              <button className="font-medium text-primary hover:underline" onClick={() => setBudgetOpen(true)}>Set a monthly budget</button>
            )
          }
        />
        <StatCard
          label="Highest category"
          icon={Crown}
          tone="amber"
          loading={!s}
          value={s?.top_category ? s.top_category.category : <span className="text-lg text-muted-foreground">—</span>}
          footer={s?.top_category && `${inr(s.top_category.total)} · ${s.top_category.percent.toFixed(0)}% of spending`}
        />
        <StatCard
          label="Average daily spend"
          icon={CalendarClock}
          tone="success"
          loading={!s}
          value={s && inr(s.average_daily)}
          footer={s && `Across ${s.days_counted} day${s.days_counted === 1 ? "" : "s"} · ${s.count} transaction${s.count === 1 ? "" : "s"}`}
        />
      </section>

      {empty ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title="No expenses in this period"
            text="Tell the assistant what you spent — “₹250 on lunch” — or add a transaction manually to see your dashboard come alive."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link to="/chat"><MessageSquareText /> Open AI chat</Link></Button>
                <Button variant="outline" onClick={openAdd}><Plus /> Add manually</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Spending by category</CardTitle></CardHeader>
              <CardContent>
                {!breakdown.data ? breakdown.isError ? (
                  <ErrorNote error={breakdown.error} retry={() => breakdown.refetch()} />
                ) : (
                  <Skeleton className="h-[320px] w-full" />
                ) : (
                  <>
                    <CategoryDonut data={breakdown.data} height={200} />
                    <div className="mt-5"><CategoryLegend data={breakdown.data} limit={5} /></div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Spending trend</CardTitle>
                <span className="text-xs text-muted-foreground">{{ day: "Daily", week: "Weekly", month: "Monthly" }[granularityFor(s?.range.days)]}</span>
              </CardHeader>
              <CardContent>{!trend.data ? trend.isError ? <ErrorNote error={trend.error} retry={() => trend.refetch()} /> : <Skeleton className="h-[300px] w-full" /> : <TrendChart points={trend.data} variant={granularityFor(s?.range.days) === "day" ? "area" : "bar"} height={300} />}</CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent transactions</CardTitle>
                <Link to="/expenses" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
              </CardHeader>
              <CardContent>
                {!recent.data ? recent.isError ? (
                  <ErrorNote error={recent.error} retry={() => recent.refetch()} />
                ) : (
                  <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <ul className="divide-y">{recent.data.items.map((e) => <TransactionRow key={e.id} e={e} />)}</ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget overview</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setBudgetOpen(true)}>Adjust</Button>
              </CardHeader>
              <CardContent>
                {budgets.isError ? (
                  <ErrorNote error={budgets.error} retry={() => budgets.refetch()} />
                ) : budgets.isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : !budgets.data?.items.length ? (
                  <EmptyState icon={PiggyBank} title="No budgets yet" text="Set a monthly limit to track how much you have left." action={<Button size="sm" onClick={() => setBudgetOpen(true)}>Set a budget</Button>} />
                ) : (
                  <div className="space-y-5">
                    {overall && (
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/70 p-3 text-center">
                        <Fig label="Spent" value={inr(overall.spent)} />
                        <Fig label="Budget" value={inr(overall.amount)} />
                        <Fig label={overall.remaining < 0 ? "Over by" : "Remaining"} value={inr(Math.abs(overall.remaining))} tone={overall.remaining < 0 ? "bad" : "good"} />
                      </div>
                    )}
                    {overall && <BudgetRow item={overall} compact />}
                    {catBudgets.slice(0, 4).map((b) => <BudgetRow key={b.id} item={b} compact />)}
                    <p className="text-xs text-muted-foreground">Budgets track {budgets.data.month}, independent of the date filter.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Spending insights</CardTitle>
              <InsightsBadge />
            </CardHeader>
            <CardContent>
              {insights.isError ? <ErrorNote error={insights.error} retry={() => insights.refetch()} /> : <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                <InsightsList insights={insights.data} loading={insights.isLoading} limit={4} />
              </div>}
            </CardContent>
          </Card>
        </>
      )}

      <BudgetFormDialog open={budgetOpen} onOpenChange={setBudgetOpen} initial={overall ? { category: "Overall", amount: overall.amount } : null} />
    </div>
  );
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-0.5 text-sm font-semibold", tone === "good" && "text-success", tone === "bad" && "text-[#E5483A]")}>{value}</p>
    </div>
  );
}
