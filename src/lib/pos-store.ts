import { DEFAULT_SETTINGS, type Settings, type Transaction } from "./pos-types";

const SETTINGS_KEY = "ccr.settings";
const TX_KEY = "ccr.transactions";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      prices: { ...DEFAULT_SETTINGS.prices, ...(parsed.prices ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("ccr-settings-changed"));
}

export function loadTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveTransaction(tx: Transaction) {
  const all = loadTransactions();
  all.unshift(tx);
  localStorage.setItem(TX_KEY, JSON.stringify(all));
}

export async function pushToSheets(endpoint: string, tx: Transaction): Promise<boolean> {
  if (!endpoint) return false;
  try {
    const rows = tx.items.map((item) => ({
      timestamp: tx.timestamp,
      transactionId: tx.id,
      productName: `${item.variantName}${item.size === "jumbo" ? " Jumbo" : ""}`,
      filling: item.filling ?? "",
      celup: item.celup ?? "",
      tabur: item.tabur ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
      paymentMethod: tx.paymentMethod,
      deliveryFee: tx.deliveryFee,
      grandTotal: tx.grandTotal,
    }));
    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: tx, rows }),
    });
    return true;
  } catch {
    return false;
  }
}

export function formatRp(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}
