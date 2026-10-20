export interface User {
  id: number;
  email: string;
  name: string;
}

export interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string;
  expense_date: string;
  created_at?: string;
}

export interface ExpensePage {
  items: Expense[];
  total: number;
  page: number;
  page_size: number;
  total_amount: number;
}

export interface RangeInfo {
  start: string;
  end: string;
  label: string;
  days: number;
}

export interface CategoryStat {
  category: string;
  total: number;
  count: number;
  percent: number;
}

export interface Summary {
  range: RangeInfo;
  category: string | null;
  total: number;
  count: number;
  average_transaction: number;
  average_daily: number;
  days_counted: number;
  top_category: CategoryStat | null;
}

export interface SummaryWithPrev extends Summary {
  previous: { range: RangeInfo; total: number; count: number; average_daily: number };
  change_percent: number | null;
}

export interface TrendPoint {
  period: string;
  label: string;
  total: number;
}

export type BudgetStatusKind = "ok" | "warning" | "over";

export interface BudgetItem {
  id: number;
  category: string;
  is_overall: boolean;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatusKind;
}

export interface BudgetStatus {
  month: string;
  total_spent: number;
  overall: BudgetItem | null;
  items: BudgetItem[];
}

export interface Insight {
  kind: string;
  severity: "info" | "positive" | "warning" | "danger";
  title: string;
  text: string;
}

export interface CategoryDelta {
  category: string;
  a: number;
  b: number;
  difference: number;
  percent_change: number | null;
}

export interface Compare {
  a: { range: RangeInfo; total: number; count: number; average_daily: number };
  b: { range: RangeInfo; total: number; count: number; average_daily: number };
  difference: number;
  percent_change: number | null;
  direction: "up" | "down" | "flat";
  categories: CategoryDelta[];
  category: string | null;
}

// ---- chat blocks (rendered from backend tool results) ----
export type Block =
  | { type: "expense_saved"; expense: Expense; month: string; month_total: number; category_month_total: number; budget: BudgetItem | null }
  | { type: "expense_updated"; before: Expense; after: Expense }
  | { type: "expense_deleted"; expense: Expense }
  | { type: "expense_list"; title: string; range: RangeInfo; items: Expense[]; count: number; shown: number; total: number }
  | { type: "spending_summary"; summary: Summary; categories: CategoryStat[] }
  | { type: "top_category"; range: RangeInfo; top: CategoryStat | null; categories: CategoryStat[] }
  | { type: "comparison"; data: Compare }
  | { type: "budget_status"; action: "get" | "set" | "delete"; created?: boolean; focus: string | null; month: string; items: BudgetItem[] }
  | { type: "clarification"; question: string; options: string[] }
  | { type: "confirm_delete"; expense: Expense }
  | { type: "error"; message: string };

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  blocks: Block[] | null;
  created_at: string;
}

export interface ChatResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}
