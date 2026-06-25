import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_PRICES,
  DEFAULT_SETTINGS,
  type CartItem,
  type Settings,
  type Transaction,
} from "./pos-types";

const SETTINGS_KEY = "ccr.settings";
const TX_KEY = "ccr.transactions";
const CART_KEY = "ccr.cart";
const PAY_KEY = "ccr.payment";

// Fallback in-memory storage for when native module is unavailable
const memoryStore = new Map<string, string>();
let useMemoryFallback = false;

async function safeGetItem(key: string): Promise<string | null> {
  try {
    if (useMemoryFallback) return memoryStore.get(key) ?? null;
    return await AsyncStorage.getItem(key);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Native module is null")
    ) {
      useMemoryFallback = true;
      return memoryStore.get(key) ?? null;
    }
    return null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    if (useMemoryFallback) {
      memoryStore.set(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Native module is null")
    ) {
      useMemoryFallback = true;
      memoryStore.set(key, value);
    }
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await safeGetItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const incoming = parsed.prices ?? {};
    const migrated: Record<string, unknown> = {};
    for (const k of Object.keys(
      DEFAULT_PRICES,
    ) as (keyof typeof DEFAULT_PRICES)[]) {
      const v = incoming[k];
      if (v && typeof v === "object" && "regular" in v && "jumbo" in v) {
        migrated[k] = v;
      } else if (
        v &&
        typeof v === "object" &&
        ("normal" in v || "kuantar" in v)
      ) {
        migrated[k] = {
          regular: {
            normal:
              (v as Record<string, number>).normal ??
              DEFAULT_PRICES[k].regular.normal,
            kuantar:
              (v as Record<string, number>).kuantar ??
              DEFAULT_PRICES[k].regular.kuantar,
          },
          jumbo: DEFAULT_PRICES[k].jumbo,
        };
      } else {
        migrated[k] = DEFAULT_PRICES[k];
      }
    }
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      prices: migrated as Settings["prices"],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await safeSetItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function nextInvoiceId(): Promise<string> {
  const s = await loadSettings();
  const next = (s.invoiceCounter ?? 0) + 1;
  await saveSettings({ ...s, invoiceCounter: next });
  return "INV-" + String(next).padStart(3, "0");
}

export async function loadTransactions(): Promise<Transaction[]> {
  try {
    const raw = await safeGetItem(TX_KEY);
    return JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
}

export async function saveTransaction(tx: Transaction): Promise<void> {
  const all = await loadTransactions();
  all.unshift(tx);
  await safeSetItem(TX_KEY, JSON.stringify(all));
}

export async function loadCart(): Promise<CartItem[]> {
  try {
    const raw = await safeGetItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((i: Record<string, unknown>) => ({
        size: "regular",
        ...i,
      })) as CartItem[];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]): void {
  safeSetItem(CART_KEY, JSON.stringify(cart));
}

export async function loadPayment(): Promise<string | null> {
  return safeGetItem(PAY_KEY);
}

export function savePayment(pm: string): void {
  safeSetItem(PAY_KEY, pm);
}

export async function pushToSheets(
  endpoint: string,
  tx: Transaction,
): Promise<boolean> {
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
