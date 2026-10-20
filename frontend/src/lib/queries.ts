import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qs } from "./api";
import { rangeParams, type RangeSel } from "./range";
import type { BudgetStatus, CategoryStat, Compare, ExpensePage, Insight, Summary, SummaryWithPrev, TrendPoint, Expense, RangeInfo } from "./types";

export const useBudgetStatus = () => useQuery({ queryKey: ["budgets"], queryFn: () => api.get<BudgetStatus>("/budgets") });

export const useInsights = () =>
  useQuery({ queryKey: ["analytics", "insights"], queryFn: () => api.get<{ insights: Insight[] }>("/analytics/insights").then((r) => r.insights) });

export const useSummary = (r: RangeSel) =>
  useQuery({ queryKey: ["analytics", "summary", r], queryFn: () => api.get<SummaryWithPrev>(`/analytics/summary${qs(rangeParams(r))}`), placeholderData: keepPreviousData });

export const useBreakdown = (r: RangeSel) =>
  useQuery({
    queryKey: ["analytics", "breakdown", r],
    queryFn: () => api.get<{ range: RangeInfo; categories: CategoryStat[] }>(`/analytics/category-breakdown${qs(rangeParams(r))}`).then((x) => x.categories),
    placeholderData: keepPreviousData,
  });

export const useTrend = (r: RangeSel, granularity: "day" | "week" | "month") =>
  useQuery({
    queryKey: ["analytics", "trend", r, granularity],
    queryFn: () => api.get<{ points: TrendPoint[] }>(`/analytics/trend${qs({ ...rangeParams(r), granularity })}`).then((x) => x.points),
    placeholderData: keepPreviousData,
  });

export const useTop = (r: RangeSel, limit = 5) =>
  useQuery({
    queryKey: ["analytics", "top", r, limit],
    queryFn: () => api.get<{ items: Expense[] }>(`/analytics/top-expenses${qs({ ...rangeParams(r), limit })}`).then((x) => x.items),
    placeholderData: keepPreviousData,
  });

export const useCompare = (r: RangeSel) =>
  useQuery({ queryKey: ["analytics", "compare", r], queryFn: () => api.get<Compare>(`/analytics/compare${qs(rangeParams(r))}`), placeholderData: keepPreviousData });

export const useMonthly = (months = 6) =>
  useQuery({
    queryKey: ["analytics", "monthly", months],
    queryFn: () => api.get<{ points: TrendPoint[] }>(`/analytics/month-over-month?months=${months}`).then((x) => x.points),
  });

export const useBudgetVsActual = () =>
  useQuery({
    queryKey: ["analytics", "budget-vs-actual"],
    queryFn: () => api.get<{ items: { category: string; budget: number; actual: number; percent: number; status: string }[] }>("/analytics/budget-vs-actual").then((x) => x.items),
  });

export const useRecent = (r: RangeSel, n = 6) =>
  useQuery({
    queryKey: ["expenses", "recent", r, n],
    queryFn: () => api.get<ExpensePage>(`/expenses${qs({ ...rangeParams(r), page_size: n })}`),
    placeholderData: keepPreviousData,
  });

export type { Summary };

/** Pick a sensible trend granularity for a range length. */
export function granularityFor(days: number | undefined): "day" | "week" | "month" {
  if (!days || days <= 62) return "day";
  if (days <= 200) return "week";
  return "month";
}
