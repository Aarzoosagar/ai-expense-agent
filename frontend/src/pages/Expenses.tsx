import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon, EmptyState, ErrorNote, PageHeader } from "@/components/common";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { api, qs } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { fmtDate, inr } from "@/lib/format";
import { useQuickAdd } from "@/lib/quickadd";
import { rangeParams, RANGE_PRESETS, type RangeSel } from "@/lib/range";
import type { Expense, ExpensePage } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
type SortBy = "date" | "amount";

export default function Expenses() {
  const qc = useQueryClient();
  const { openAdd } = useQuickAdd();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [range, setRange] = useState<RangeSel>({ period: "all_time" });
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = { q, category, ...rangeParams(range), sort_by: sortBy, order, page, page_size: PAGE_SIZE };
  const list = useQuery({
    queryKey: ["expenses", "list", params],
    queryFn: () => api.get<ExpensePage>(`/expenses${qs(params)}`),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Expense deleted");
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filtered = !!(q || category || range.start_date || range.end_date || (range.period && range.period !== "all_time"));

  // keep the page valid when the result set shrinks (e.g. after a delete)
  useEffect(() => {
    if (data && page > pages) setPage(pages);
  }, [data, page, pages]);

  function toggleSort(col: SortBy) {
    if (sortBy === col) setOrder(order === "desc" ? "asc" : "desc");
    else {
      setSortBy(col);
      setOrder("desc");
    }
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setRange({ period: "all_time" });
    setPage(1);
  }

  const SortIcon = ({ col }: { col: SortBy }) => (sortBy !== col ? <ArrowUpDown className="size-3.5 opacity-40" /> : order === "desc" ? <ArrowDown className="size-3.5 text-primary" /> : <ArrowUp className="size-3.5 text-primary" />);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Search, filter and manage every transaction."
        actions={
          <Button onClick={openAdd}>
            <Plus /> Add expense
          </Button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search expenses" placeholder="Search description or category…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full lg:w-52">
            <Select
              aria-label="Filter by category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <DateRangeFilter
            value={range}
            presets={[{ key: "all_time", label: "All time" }, ...RANGE_PRESETS.filter((p) => p.key !== "all_time")]}
            onChange={(r) => {
              setRange(r);
              setPage(1);
            }}
          />
          {filtered && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X /> Clear
            </Button>
          )}
        </div>
      </Card>

      {list.isError && <ErrorNote error={list.error} retry={() => list.refetch()} />}

      <Card className="overflow-hidden">
        {/* desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Transaction</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">
                  <button className="inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-foreground" onClick={() => toggleSort("date")}>
                    Date <SortIcon col="date" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button className="inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-foreground" onClick={() => toggleSort("amount")}>
                    Amount <SortIcon col="amount" />
                  </button>
                </th>
                <th className="w-24 px-5 py-3" />
              </tr>
            </thead>
            <tbody className={cn("divide-y transition-opacity", list.isPlaceholderData && "opacity-60")}>
              {!data
                ? [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-3"><Skeleton className="h-10 w-full" /></td>
                    </tr>
                  ))
                : data.items.map((e) => (
                    <tr key={e.id} className="group transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <CategoryIcon category={e.category} />
                          <span className="font-medium">{e.description || e.category}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Badge tone="primary">{e.category}</Badge></td>
                      <td className="tabular px-3 py-3 text-muted-foreground">{fmtDate(e.expense_date, true)}</td>
                      <td className="tabular px-3 py-3 text-right font-semibold">{inr(e.amount)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${e.description || e.category}`} onClick={() => setEditing(e)}><Pencil /></Button>
                          <Button variant="ghost" size="icon" className="size-8 hover:text-[#E5483A]" aria-label={`Delete ${e.description || e.category}`} onClick={() => setDeleting(e)}><Trash2 /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* mobile list */}
        <ul className="divide-y md:hidden">
          {!data
            ? [0, 1, 2, 3].map((i) => <li key={i} className="p-4"><Skeleton className="h-12 w-full" /></li>)
            : data.items.map((e) => (
                <li key={e.id} className="flex items-center gap-3 p-4">
                  <CategoryIcon category={e.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.description || e.category}</p>
                    <p className="text-xs text-muted-foreground">{e.category} · {fmtDate(e.expense_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-semibold">{inr(e.amount)}</p>
                    <div className="mt-1 flex justify-end gap-3 text-xs">
                      <button className="font-medium text-primary" onClick={() => setEditing(e)}>Edit</button>
                      <button className="font-medium text-[#E5483A]" onClick={() => setDeleting(e)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
        </ul>

        {data && data.total === 0 && (
          <EmptyState
            icon={Receipt}
            title={filtered ? "No matching expenses" : "No expenses yet"}
            text={filtered ? "Try a different search or widen the date range." : "Add your first expense manually or by chatting with the assistant."}
            action={filtered ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : <Button onClick={openAdd}><Plus /> Add expense</Button>}
          />
        )}

        {data && data.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 text-sm sm:flex-row">
            <p className="text-muted-foreground">
              Showing <b className="text-foreground">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)}</b> of <b className="text-foreground">{data.total}</b>
              <span className="mx-2">·</span>
              Total <b className="tabular text-foreground">{inr(data.total_amount)}</b>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft /> Prev</Button>
              <span className="tabular px-1 text-xs text-muted-foreground">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight /></Button>
            </div>
          </div>
        )}
      </Card>

      <ExpenseFormDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} expense={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this expense?"
        description={deleting && <p className="text-sm text-muted-foreground">{inr(deleting.amount)} · {deleting.description || deleting.category} on {fmtDate(deleting.expense_date, true)}. This can't be undone.</p>}
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
