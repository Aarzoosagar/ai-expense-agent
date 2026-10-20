import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryMeta } from "@/lib/categories";
import { inr, inrCompact } from "@/lib/format";
import type { CategoryStat, TrendPoint } from "@/lib/types";

const AXIS = { fontSize: 11, fill: "hsl(228 14% 50%)" };

interface TipProps {
  active?: boolean;
  payload?: { value?: number; name?: string; color?: string; payload?: { label?: string; category?: string } }[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  const title = label ?? payload[0].payload?.category ?? payload[0].payload?.label;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1 font-medium">{title}</p>}
      {payload.map((p, i) => (
        <p key={i} className="tabular flex items-center gap-2 text-muted-foreground">
          {p.color && <span className="size-2 rounded-full" style={{ background: p.color }} />}
          {payload.length > 1 && p.name ? `${p.name}: ` : ""}
          <span className="font-semibold text-foreground">{inr(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export function CategoryDonut({ data, height = 220, centerLabel = "Total spent" }: { data: CategoryStat[]; height?: number; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="category" innerRadius="66%" outerRadius="94%" paddingAngle={data.length > 1 ? 2 : 0} cornerRadius={5} stroke="none" isAnimationActive>
            {data.map((d) => (
              <Cell key={d.category} fill={categoryMeta(d.category).color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{centerLabel}</p>
          <p className="tabular text-xl font-semibold tracking-tight">{inrCompact(total)}</p>
        </div>
      </div>
    </div>
  );
}

export function CategoryLegend({ data, limit }: { data: CategoryStat[]; limit?: number }) {
  const rows = limit ? data.slice(0, limit) : data;
  return (
    <ul className="space-y-2.5">
      {rows.map((d) => (
        <li key={d.category} className="flex items-center gap-3 text-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryMeta(d.category).color }} />
          <span className="min-w-0 flex-1 truncate">{d.category}</span>
          <span className="tabular text-xs text-muted-foreground">{d.percent.toFixed(0)}%</span>
          <span className="tabular w-20 text-right font-medium">{inr(d.total)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TrendChart({ points, variant = "area", height = 240 }: { points: TrendPoint[]; variant?: "area" | "bar"; height?: number }) {
  const common = {
    data: points,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="hsl(250 30% 91%)" />
      <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={inrCompact} />
      <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(251 89% 65% / .25)", fill: "hsl(251 89% 65% / .06)" }} />
    </>
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {variant === "area" ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7357F5" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7357F5" stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area type="monotone" dataKey="total" stroke="#7357F5" strokeWidth={2.5} fill="url(#trendFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          </AreaChart>
        ) : (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="total" fill="#7357F5" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetActualChart({ items, height = 260 }: { items: { category: string; budget: number; actual: number; status: string }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="hsl(250 30% 91%)" />
          <XAxis dataKey="category" tick={AXIS} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} tickFormatter={inrCompact} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(251 89% 65% / .06)" }} />
          <Bar dataKey="budget" name="Budget" fill="#D9D1FC" radius={[6, 6, 0, 0]} maxBarSize={28} />
          <Bar dataKey="actual" name="Actual" radius={[6, 6, 0, 0]} maxBarSize={28}>
            {items.map((i) => (
              <Cell key={i.category} fill={i.status === "over" ? "#FF6B5B" : i.status === "warning" ? "#F59E0B" : "#7357F5"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
