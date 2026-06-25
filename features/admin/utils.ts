import type { Transaction } from "@/lib/pos-types";

export type Range = "today" | "week" | "all";

export function filterTransactions(
  transactions: Transaction[],
  range: Range,
  search: string,
): Transaction[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfWeek = startOfToday - now.getDay() * 86400000;
  const q = search.trim().toLowerCase();

  return transactions.filter((tx) => {
    const t = new Date(tx.timestamp).getTime();
    if (range === "today" && t < startOfToday) return false;
    if (range === "week" && t < startOfWeek) return false;
    if (q) {
      const hit =
        tx.id.toLowerCase().includes(q) ||
        tx.items.some((i) => i.variantName.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

export function getTodayStats(transactions: Transaction[]) {
  const todayKey = new Date().toDateString();
  const todayTx = transactions.filter(
    (t) => new Date(t.timestamp).toDateString() === todayKey,
  );
  const todaySales = todayTx.reduce((sum, t) => sum + t.grandTotal, 0);
  const avg = todayTx.length ? Math.round(todaySales / todayTx.length) : 0;
  return { todayTx, todaySales, avg };
}
