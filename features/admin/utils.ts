import type { Transaction } from "@/lib/pos-types";
import { Alert, Platform } from "react-native";

export type Range = "today" | "week" | "all";

/** Web-compatible alert; falls back to window.alert() in the browser. */
export function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/** Web-compatible destructive confirm; falls back to window.confirm() in the browser. */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: onConfirm },
    ]);
  }
}

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
