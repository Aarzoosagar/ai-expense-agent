import { ArrowDownRight, ArrowUpRight, Crown, Hash, Receipt, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { BudgetActualChart, CategoryDonut, CategoryLegend, TrendChart } from "@/components/charts";
import { CategoryIcon, Delta, EmptyState, ErrorNote, PageHeader, StatCard } from "@/components/common";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { InsightsBadge, InsightsList } from "@/components/insights";
import { TransactionRow } from "@/components/transactions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { inr, pctText } from "@/lib/format";
import { useBreakdown, useBudgetVsActual, useCompare, useInsights, useMonthly, useSummary, useTop, useTrend } from "@/lib/queries";
import { DEFAULT_RANGE, type RangeSel } from "@/lib/range";
import { cn } from "@/lib/utils";

type Gran = "day" | "week" | "month";
const GRANS: { key: Gran; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

export default function Analytics() {
  const [range, setRange] = useState<RangeSel>(DEFAULT_RANGE);
  const [gran, setGran] = useState<Gran>("day");

  const summary = useSummary(range);
  const breakdown = useBreakdown(range);
  const trend = useTrend(range, gran);
  const top = useTop(range, 5);
  const compare = useCompare(range);
  const monthly = useMonthly(6);
  const bva = useBudgetVsActual();
  const insights = useInsights();

  const s = summary.data;
  const c = compare.data;
  const empty = !!s && s.count === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Understand your spending patterns." actions={<DateRangeFilter value={range} onChange={setRange} />} />
      {summary.isError && <ErrorNote error={summary.error} retry={() => summary.refetch()} />}
      {breakdown.isError && <ErrorNote error={breakdown.error} retry={() => breakdown.refetch()} />}
      {trend.isError && <ErrorNote error={trend.error} retry={() => trend.refetch()} />}
      {top.isError && <ErrorNote error={top.error} retry={() => top.refetch()} />}
      {compare.isError && <ErrorNote error={compare.error} retry={() => compare.refetch()} />}
      {monthly.isError && <ErrorNote error={monthly.error} retry={() => monthly.refetch()} />}
      {bva.isError && <ErrorNote error={bva.error} retry={() => bva.refetch()} />}
      {insights.isError && <ErrorNote error={insights.error} retry={() => insights.refetch()} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
        <StatCard label="Total spent" icon={Wallet} loading={!s} value={s && inr(s.total)} footer={s && <><Delta percent={s.change_percent} /> <span>vs {s.previous.range.label.toLowerCase()}</span></>} />
        <StatCard label="Average transaction" icon={Receipt} tone="success" loading={!s} value={s && inr(s.average_transaction)} footer={s && `${s.count} transaction${s.count === 1 ? "" : "s"}`} />
        <StatCard
          label="Largest category"
          icon={Crown}
          tone="amber"
          loading={!s}
          value={s?.top_category?.category ?? <span className="text-lg text-muted-foreground">—</span>}
          footer={s?.top_category && `${inr(s.top_category.total)} · ${s.top_category.percent.toFixed(0)}% of total`}
        />
        <StatCard label="Average per day" icon={Hash} tone="navy" loading={!s} value={s && inr(s.average_daily)} footer={s && `Over ${s.days_counted} day${s.days_counted === 1 ? "" : "s"}`} />
      </section>

      {empty ? (
        <Card><EmptyState icon={Receipt} title="Nothing to analyse in this period" text="Pick a wider date range or add some expenses." /></Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Category breakdown</CardTitle></CardHeader>
              <CardContent>
                {!breakdown.data ? breakdown.isError ? null : <Skeleton className="h-[340px]" /> : (
                  <>
                    <CategoryDonut data={breakdown.data} height={210} />
                    <div className="mt-5"><CategoryLegend data={breakdown.data} /></div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <div>
                  <CardTitle>Spending trend</CardTitle>
                  <CardDescription>{s?.range.label}</CardDescription>
                </div>
                <div role="tablist" aria-label="Trend granularity" className="inline-flex rounded-lg bg-muted p-1">
                  {GRANS.map((g) => (
                    <button
                      key={g.key}
                      role="tab"
                      aria-selected={gran === g.key}
                      onClick={() => setGran(g.key)}
                      className={cn("rounded-md px-3 py-1 text-xs font-medium transition-all", gran === g.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>{!trend.data ? trend.isError ? null : <Skeleton className="h-[320px]" /> : <TrendChart points={trend.data} variant={gran === "day" ? "area" : "bar"} height={320} />}</CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top 5 transactions</CardTitle></CardHeader>
              <CardContent>
                {!top.data ? top.isError ? null : <Skeleton className="h-64" /> : (
                  <ol className="divide-y">
                    {top.data.map((e, i) => (
                      <div key={e.id} className="flex items-center gap-3">
                        <span className="tabular w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                        <ul className="flex-1"><TransactionRow e={e} /></ul>
                      </div>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Period comparison</CardTitle>
                  <CardDescription>{c ? `${c.a.range.label} vs ${c.b.range.label}` : "…"}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {!c ? compare.isError ? null : <Skeleton className="h-64" /> : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-accent/70 p-4">
                        <p className="text-xs text-muted-foreground">{c.a.range.label}</p>
                        <p className="tabular mt-1 text-xl font-semibold">{inr(c.a.total)}</p>
                      </div>
                      <div className="rounded-xl bg-muted/70 p-4">
                        <p className="text-xs text-muted-foreground">{c.b.range.label}</p>
                        <p className="tabular mt-1 text-xl font-semibold">{inr(c.b.total)}</p>
                      </div>
                    </div>
                    <p className="flex items-center gap-2 text-sm">
                      {c.direction === "up" ? <ArrowUpRight className="size-4 text-[#E5483A]" /> : c.direction === "down" ? <ArrowDownRight className="size-4 text-success" /> : null}
                      <span className={cn("font-semibold", c.direction === "up" ? "text-[#E5483A]" : c.direction === "down" ? "text-success" : "")}>
                        {c.direction === "flat" ? "No change" : `${inr(Math.abs(c.difference))} ${c.direction === "up" ? "more" : "less"}`}
                      </span>
                      {c.percent_change !== null && c.direction !== "flat" && <span className="text-muted-foreground">({pctText(c.percent_change)})</span>}
                    </p>
                    <ul className="space-y-2.5">
                      {c.categories.slice(0, 5).map((d) => (
                        <li key={d.category} className="flex items-center gap-3 text-sm">
                          <CategoryIcon category={d.category} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{d.category}</span>
                          <span className="tabular text-xs text-muted-foreground">{inr(d.b)} → {inr(d.a)}</span>
                          <span className={cn("tabular w-20 text-right text-xs font-semibold", d.difference > 0 ? "text-[#E5483A]" : d.difference < 0 ? "text-success" : "text-muted-foreground")}>
                            {d.difference > 0 ? "+" : d.difference < 0 ? "−" : ""}{inr(Math.abs(d.difference))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Month-over-month</CardTitle>
              <CardDescription>Total spending, last 6 months</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{!monthly.data ? monthly.isError ? null : <Skeleton className="h-[260px]" /> : <TrendChart points={monthly.data} variant="bar" height={260} />}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Budget vs actual</CardTitle>
              <CardDescription>This month, categories with a budget</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!bva.data ? bva.isError ? null : <Skeleton className="h-[260px]" /> : bva.data.length === 0 ? (
              <EmptyState icon={Wallet} title="No budgets to compare" text="Set a budget on the Budgets page to see it plotted against real spending." />
            ) : (
              <BudgetActualChart items={bva.data} height={260} />
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Insights</CardTitle>
          <InsightsBadge />
        </CardHeader>
        <CardContent>
          {!insights.isError && <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
            <InsightsList insights={insights.data} loading={insights.isLoading} />
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}
