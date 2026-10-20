import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { todayIST } from "@/lib/format";
import { RANGE_PRESETS, type RangeSel } from "@/lib/range";

export function DateRangeFilter({ value, onChange, presets = RANGE_PRESETS }: { value: RangeSel; onChange: (r: RangeSel) => void; presets?: { key: string; label: string }[] }) {
  const hasCustom = !!(value.start_date || value.end_date);
  const [custom, setCustom] = useState(hasCustom);
  const today = todayIST();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[10.5rem]">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Select
          aria-label="Date range"
          className="pl-9"
          value={custom || hasCustom ? "custom" : (value.period ?? "this_month")}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") {
              setCustom(true);
              onChange({ start_date: value.start_date ?? `${today.slice(0, 8)}01`, end_date: value.end_date ?? today });
            } else {
              setCustom(false);
              onChange({ period: v });
            }
          }}
        >
          {presets.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
          <option value="custom">Custom range…</option>
        </Select>
      </div>
      {(custom || hasCustom) && (
        <div className="flex items-center gap-2 animate-fade-in">
          <Input
            type="date"
            aria-label="From date"
            className="w-[9.5rem]"
            max={value.end_date ?? today}
            value={value.start_date ?? ""}
            onChange={(e) => onChange({ start_date: e.target.value || undefined, end_date: value.end_date })}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="To date"
            className="w-[9.5rem]"
            min={value.start_date}
            max={today}
            value={value.end_date ?? ""}
            onChange={(e) => onChange({ start_date: value.start_date, end_date: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}
