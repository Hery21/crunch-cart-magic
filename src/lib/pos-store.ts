import { DEFAULT_SETTINGS, DEFAULT_PRICES, type Settings, type Transaction } from "./pos-types";

const SETTINGS_KEY = "ccr.settings";
const TX_KEY = "ccr.transactions";
const CART_KEY = "ccr.cart";
const PAY_KEY = "ccr.payment";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      prices: { ...DEFAULT_PRICES, ...(parsed.prices ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("ccr-settings-changed"));
}

export function nextInvoiceId(): string {
  const s = loadSettings();
  const next = (s.invoiceCounter ?? 0) + 1;
  saveSettings({ ...s, invoiceCounter: next });
  return "INV-" + String(next).padStart(3, "0");
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

export function loadCart<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function saveCart(cart: unknown) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
export function loadPayment(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PAY_KEY);
}
export function savePayment(pm: string) {
  localStorage.setItem(PAY_KEY, pm);
}

export async function pushToSheets(endpoint: string, tx: Transaction): Promise<boolean> {
  if (!endpoint) return false;
  try {
    const rows = tx.items.map((item) => ({
      timestamp: tx.timestamp,
      transactionId: tx.id,
      productName: item.variantName,
      size: item.size === "jumbo" ? "Jumbo" : "Regular",
      filling: item.filling ?? "",
      celup: item.celup ?? "",
      tabur: item.tabur ?? "",
      quantity: item.quantity,
      priceTier: item.priceTier === "kuantar" ? "Kuantar" : "Normal",
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
      paymentMethod: tx.paymentMethod,
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
