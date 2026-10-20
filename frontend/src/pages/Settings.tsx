import { useQuery } from "@tanstack/react-query";
import { Check, CircleAlert, Database, Download, Globe2, Loader2, LogOut, UserRound, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorNote, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { todayIST } from "@/lib/format";
import type { Expense, ExpensePage } from "@/lib/types";

interface HealthStatus {
  status: "ok" | "degraded";
  database: "up" | "down";
  llm_provider: string;
  llm_configured: boolean;
  timezone: string;
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function downloadExpenses(): Promise<number> {
  const pageSize = 100;
  const first = await api.get<ExpensePage>(`/expenses${qs({ page: 1, page_size: pageSize })}`);
  const rows: Expense[] = [...first.items];
  const pageCount = Math.ceil(first.total / pageSize);

  for (let page = 2; page <= pageCount; page += 1) {
    const result = await api.get<ExpensePage>(`/expenses${qs({ page, page_size: pageSize })}`);
    rows.push(...result.items);
  }

  const header = ["Date", "Category", "Description", "Amount (INR)", "Expense ID"];
  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((expense) =>
      [expense.expense_date, expense.category, expense.description, expense.amount, expense.id].map(csvCell).join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `expenses-${todayIST()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return rows.length;
}

function Status({ ok, children }: { ok: boolean; children: string }) {
  const Icon = ok ? Check : CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthStatus>("/health"),
    staleTime: 60_000,
  });

  async function exportData() {
    setExporting(true);
    try {
      const count = await downloadExpenses();
      toast.success(`Exported ${count} expense${count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't export expenses");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Your account, connections, and data." />

      {health.isError && <ErrorNote error={health.error} retry={() => health.refetch()} />}

      <section aria-label="Account settings">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your personal Expense Agent profile.</CardDescription>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><UserRound className="size-5" /></span>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="text-xs font-medium text-muted-foreground">Name</dt>
                <dd className="mt-1 truncate text-sm font-semibold">{user?.name ?? "—"}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                <dd className="mt-1 truncate text-sm font-semibold">{user?.email ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">Your account data is scoped to your signed-in profile.</p>
              <Button variant="outline" onClick={logout}><LogOut /> Sign out</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Application connections">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Connections</CardTitle>
              <CardDescription>Live status reported by your backend.</CardDescription>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><WandSparkles className="size-5" /></span>
          </CardHeader>
          <CardContent>
            {health.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking services…</div>
            ) : health.data ? (
              <div className="divide-y">
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3"><Database className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Database</span></div>
                  <Status ok={health.data.database === "up"}>{health.data.database === "up" ? "Connected" : "Unavailable"}</Status>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3"><WandSparkles className="size-4 text-muted-foreground" /><span className="text-sm font-medium">AI provider · {health.data.llm_provider}</span></div>
                  <Status ok={health.data.llm_configured}>{health.data.llm_configured ? "API key configured" : "Setup required"}</Status>
                </div>
              </div>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">Service status is unavailable. Retry the check to see current connection details.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Regional preferences">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Regional preferences</CardTitle>
              <CardDescription>Formatting used throughout your financial reports.</CardDescription>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><Globe2 className="size-5" /></span>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="text-xs font-medium text-muted-foreground">Currency</dt>
                <dd className="mt-1 text-sm font-semibold">Indian rupee (INR · ₹)</dd>
                <p className="mt-1 text-xs text-muted-foreground">Amounts use Indian digit grouping.</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-4">
                <dt className="text-xs font-medium text-muted-foreground">Timezone</dt>
                <dd className="mt-1 text-sm font-semibold">{health.data?.timezone ?? (health.isLoading ? "Checking…" : "Unavailable")}</dd>
                <p className="mt-1 text-xs text-muted-foreground">Relative dates and “today” follow this timezone.</p>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Your data">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your data</CardTitle>
              <CardDescription>Download a copy of your saved transactions.</CardDescription>
            </div>
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><Download className="size-5" /></span>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Export all of your expenses to a CSV file you can open in a spreadsheet. The export is fetched from your account and generated in this browser.</p>
              <Button onClick={() => void exportData()} disabled={exporting} className="shrink-0">
                {exporting ? <Loader2 className="animate-spin" /> : <Download />}
                {exporting ? "Preparing export…" : "Export expenses"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
