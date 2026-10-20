import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";

const Ctx = createContext<{ openAdd: () => void } | null>(null);

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ openAdd: () => setOpen(true) }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ExpenseFormDialog open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

export function useQuickAdd() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return v;
}
