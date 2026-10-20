import {
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  Package,
  Plane,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Shopping",
  "Travel",
  "Bills & Utilities",
  "Healthcare",
  "Entertainment",
  "Education",
  "Rent",
  "Other",
] as const;

export const OVERALL = "Overall";

interface Meta {
  icon: LucideIcon;
  color: string;
}

export const CATEGORY_META: Record<string, Meta> = {
  "Food & Dining": { icon: Utensils, color: "#F97316" },
  Groceries: { icon: ShoppingBasket, color: "#22C55E" },
  Shopping: { icon: ShoppingBag, color: "#7357F5" },
  Travel: { icon: Plane, color: "#3B82F6" },
  "Bills & Utilities": { icon: Zap, color: "#F59E0B" },
  Healthcare: { icon: HeartPulse, color: "#14B8A6" },
  Entertainment: { icon: Clapperboard, color: "#EC4899" },
  Education: { icon: GraduationCap, color: "#6366F1" },
  Rent: { icon: Home, color: "#0891B2" },
  Other: { icon: Package, color: "#64748B" },
  [OVERALL]: { icon: Wallet, color: "#111936" },
};

export function categoryMeta(name: string): Meta {
  return CATEGORY_META[name] ?? CATEGORY_META.Other;
}
