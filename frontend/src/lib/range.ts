export interface RangeSel {
  period?: string;
  start_date?: string;
  end_date?: string;
}

export const RANGE_PRESETS: { key: string; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "this_year", label: "This year" },
  { key: "all_time", label: "All time" },
];

export const DEFAULT_RANGE: RangeSel = { period: "this_month" };

export function rangeParams(r: RangeSel): Record<string, string | undefined> {
  if (r.start_date || r.end_date) return { start_date: r.start_date, end_date: r.end_date };
  return { period: r.period ?? "this_month" };
}
