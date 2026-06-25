import type { Transaction } from "@/lib/pos-types";
import { filterTransactions, getTodayStats } from "../utils";

function makeTx(
  overrides: Partial<Transaction> & { id: string; timestamp: string },
): Transaction {
  return {
    id: overrides.id,
    timestamp: overrides.timestamp,
    items: overrides.items ?? [],
    subtotal: overrides.subtotal ?? 0,
    grandTotal: overrides.grandTotal ?? 0,
    paymentMethod: overrides.paymentMethod ?? "Cash",
    priceTier: overrides.priceTier ?? "normal",
  };
}

const NOW = new Date();
const TODAY_ISO = NOW.toISOString();
const YESTERDAY_ISO = new Date(NOW.getTime() - 86400000).toISOString();
const LAST_WEEK_ISO = new Date(NOW.getTime() - 8 * 86400000).toISOString();

describe("filterTransactions", () => {
  const txToday = makeTx({
    id: "INV-001",
    timestamp: TODAY_ISO,
    grandTotal: 10000,
  });
  const txYesterday = makeTx({
    id: "INV-002",
    timestamp: YESTERDAY_ISO,
    grandTotal: 20000,
  });
  const txLastWeek = makeTx({
    id: "INV-003",
    timestamp: LAST_WEEK_ISO,
    grandTotal: 30000,
  });
  const all = [txToday, txYesterday, txLastWeek];

  it("filters to today only", () => {
    expect(filterTransactions(all, "today", "")).toEqual([txToday]);
  });

  it("excludes last week when range is week", () => {
    expect(filterTransactions(all, "week", "")).not.toContain(txLastWeek);
  });

  it("returns all when range is all", () => {
    expect(filterTransactions(all, "all", "")).toHaveLength(3);
  });

  it("filters by search query on id", () => {
    expect(filterTransactions(all, "all", "INV-001")).toEqual([txToday]);
  });

  it("returns empty when no match", () => {
    expect(filterTransactions(all, "all", "xyz-not-found")).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(filterTransactions([], "all", "")).toEqual([]);
  });
});

describe("getTodayStats", () => {
  const txToday1 = makeTx({
    id: "INV-001",
    timestamp: TODAY_ISO,
    grandTotal: 10000,
  });
  const txToday2 = makeTx({
    id: "INV-002",
    timestamp: TODAY_ISO,
    grandTotal: 20000,
  });
  const txYesterday = makeTx({
    id: "INV-003",
    timestamp: YESTERDAY_ISO,
    grandTotal: 5000,
  });

  it("sums only today transactions", () => {
    const { todaySales } = getTodayStats([txToday1, txToday2, txYesterday]);
    expect(todaySales).toBe(30000);
  });

  it("calculates average correctly", () => {
    const { avg } = getTodayStats([txToday1, txToday2, txYesterday]);
    expect(avg).toBe(15000);
  });

  it("returns 0 avg when no transactions today", () => {
    const { avg } = getTodayStats([txYesterday]);
    expect(avg).toBe(0);
  });

  it("returns 0 sales when no transactions today", () => {
    const { todaySales, todayTx } = getTodayStats([txYesterday]);
    expect(todaySales).toBe(0);
    expect(todayTx).toHaveLength(0);
  });
});
