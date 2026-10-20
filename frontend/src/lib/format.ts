const hasFraction = (n: number) => Math.abs(n - Math.round(n)) > 0.004;

/** ₹1,23,456 / ₹1,200.50 — Indian digit grouping. */
export function inr(n: number): string {
  const frac = hasFraction(n);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: frac ? 2 : 0,
    maximumFractionDigits: frac ? 2 : 0,
  }).format(n);
}

export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}

/** Parse an ISO date (YYYY-MM-DD) as a local date to avoid timezone shifts. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today in Asia/Kolkata as YYYY-MM-DD (matches the backend's notion of "today"). */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function fmtDate(iso: string, withYear = false): string {
  return parseISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

export function relativeDay(iso: string): string {
  const today = parseISO(todayIST());
  const diff = Math.round((today.getTime() - parseISO(iso).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return fmtDate(iso);
}

export function pctText(p: number | null | undefined): string {
  if (p === null || p === undefined) return "new";
  return `${p > 0 ? "+" : ""}${p.toFixed(0)}%`;
}

export function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
