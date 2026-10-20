import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { api } from "@/lib/api";
import { CATEGORIES, OVERALL } from "@/lib/categories";
import { inr } from "@/lib/format";
import type { BudgetStatus } from "@/lib/types";

export function BudgetFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: { category: string; amount: number } | null;
}) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>(OVERALL);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editing = !!initial;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCategory(initial?.category ?? OVERALL);
    setAmount(initial ? String(initial.amount) : "");
  }, [open, initial]);

  const save = useMutation({
    mutationFn: () => api.put<BudgetStatus>("/budgets", { category: category === OVERALL ? null : category, amount }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(`${category === OVERALL ? "Monthly" : category} budget set to ${inr(Number(amount))}`);
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setError("Enter a budget greater than zero.");
    setError(null);
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Adjust budget" : "Set a budget"}</DialogTitle>
          <DialogDescription>Monthly limits reset at the start of every month. Setting an existing budget updates it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="b-cat">Applies to</Label>
            <Select id="b-cat" value={category} disabled={editing} onChange={(e) => setCategory(e.target.value)}>
              <option value={OVERALL}>Overall monthly spending</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="b-amt">Monthly limit</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input id="b-amt" type="number" inputMode="decimal" step="1" min="0" className="pl-7 tabular" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
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
              Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
