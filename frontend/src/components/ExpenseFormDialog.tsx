import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { inr, todayIST } from "@/lib/format";
import type { Expense } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: Props) {
  const qc = useQueryClient();
  const editing = !!expense;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayIST());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setAmount(expense ? String(expense.amount) : "");
    setCategory(expense?.category ?? CATEGORIES[0]);
    setDescription(expense?.description ?? "");
    setDate(expense?.expense_date ?? todayIST());
  }, [open, expense]);

  const save = useMutation({
    mutationFn: () => {
      const body = { amount, category, description: description.trim(), expense_date: date };
      return expense ? api.put<Expense>(`/expenses/${expense.id}`, body) : api.post<Expense>("/expenses", body);
    },
    onSuccess: (e) => {
      qc.invalidateQueries();
      toast.success(editing ? "Expense updated" : `Added ${inr(e.amount)} to ${e.category}`);
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) return setError("Enter an amount greater than zero.");
    if (!date) return setError("Pick a date.");
    setError(null);
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>{editing ? "Update the details of this transaction." : "Record a new transaction manually."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input id="amount" inputMode="decimal" type="number" step="0.01" min="0" className="pl-7 tabular" placeholder="0.00" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cat">Category</Label>
              <Select id="cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" max={todayIST()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input id="desc" maxLength={255} placeholder="e.g. Dinner at Barbeque Nation" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-[#B7311F]">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
