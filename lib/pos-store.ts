import { Platform } from "react-native";

// On web, use localStorage-backed storage instead of native AsyncStorage
let AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;

if (Platform.OS === "web") {
  // Web implementation using localStorage
  AsyncStorage = {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key) ?? null;
      } catch (e) {
        console.warn(`[AsyncStorage] Failed to get ${key}:`, e);
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn(`[AsyncStorage] Failed to set ${key}:`, e);
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`[AsyncStorage] Failed to remove ${key}:`, e);
      }
    },
    clear: async () => {
      try {
        localStorage.clear();
      } catch (e) {
        console.warn(`[AsyncStorage] Failed to clear:`, e);
      }
    },
    getAllKeys: async () => {
      try {
        return Object.keys(localStorage);
      } catch (e) {
        return [];
      }
    },
    multiGet: async (keys: string[]) => {
      return keys.map((key) => [key, localStorage.getItem(key) ?? null]);
    },
    multiSet: async (keyValuePairs: Array<[string, string]>) => {
      keyValuePairs.forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => localStorage.removeItem(key));
    },
  } as any;
} else {
  // Native implementation for Android/iOS
  const NativeAsyncStorage = require("@react-native-async-storage/async-storage").default;
  AsyncStorage = NativeAsyncStorage;
}

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

// ============================================================
// NEW pushToSheets: sends order header + items
// ============================================================

/**
 * Maps a product variant + options to the integer ID in your product_catalog sheet.
 * You can either hardcode the 64 combinations or build a dynamic lookup.
 * This example uses a static map for clarity.
 */
export function getProductId(
  variantId: string,
  size: string,
  filling?: string,
  celup?: string,
  tabur?: string
): number {
  // If variantId is "tabur_celup", determine if tabur or celup is selected
  let actualVariant = variantId;
  if (variantId === "tabur_celup") {
    if (tabur) actualVariant = "tabur";
    else if (celup) actualVariant = "celup";
    // If neither, default to tabur? But UI should enforce one.
  } else if (variantId === "filling_tabur_celup") {
    // If both filling and sauce are present, determine sauce type
    if (tabur) actualVariant = "filling_tabur";
    else if (celup) actualVariant = "filling_celup";
    // else default to filling? Not possible because requires sauce.
  }

  // Build key based on actual variant
  const key = `${actualVariant}|${size}|${filling || ''}|${celup || ''}|${tabur || ''}`;

  // Full mapping for all 64 combinations
  const map: Record<string, number> = {
    'original|regular|||': 1,
    'original|jumbo|||': 2,
    'filling|regular|Mentai||': 3,
    'filling|regular|Garlic||': 4,
    'filling|regular|Cheese||': 5,
    'filling|jumbo|Mentai||': 6,
    'filling|jumbo|Garlic||': 7,
    'filling|jumbo|Cheese||': 8,
    'tabur|regular|||Barbeque Spicy': 9,
    'tabur|regular|||Sadis': 10,
    'tabur|regular|||Teriyaki': 11,
    'tabur|regular|||Lada Hitam': 12,
    'tabur|jumbo|||Barbeque Spicy': 13,
    'tabur|jumbo|||Sadis': 14,
    'tabur|jumbo|||Teriyaki': 15,
    'tabur|jumbo|||Lada Hitam': 16,
    'celup|regular||Keju|': 17,
    'celup|regular||Balado|': 18,
    'celup|regular||Sweet Corn|': 19,
    'celup|jumbo||Keju|': 20,
    'celup|jumbo||Balado|': 21,
    'celup|jumbo||Sweet Corn|': 22,
    'filling_tabur|regular|Mentai|Barbeque Spicy|': 23,
    'filling_tabur|regular|Mentai|Sadis|': 24,
    'filling_tabur|regular|Mentai|Teriyaki|': 25,
    'filling_tabur|regular|Mentai|Lada Hitam|': 26,
    'filling_tabur|regular|Garlic|Barbeque Spicy|': 27,
    'filling_tabur|regular|Garlic|Sadis|': 28,
    'filling_tabur|regular|Garlic|Teriyaki|': 29,
    'filling_tabur|regular|Garlic|Lada Hitam|': 30,
    'filling_tabur|regular|Cheese|Barbeque Spicy|': 31,
    'filling_tabur|regular|Cheese|Sadis|': 32,
    'filling_tabur|regular|Cheese|Teriyaki|': 33,
    'filling_tabur|regular|Cheese|Lada Hitam|': 34,
    'filling_tabur|jumbo|Mentai|Barbeque Spicy|': 35,
    'filling_tabur|jumbo|Mentai|Sadis|': 36,
    'filling_tabur|jumbo|Mentai|Teriyaki|': 37,
    'filling_tabur|jumbo|Mentai|Lada Hitam|': 38,
    'filling_tabur|jumbo|Garlic|Barbeque Spicy|': 39,
    'filling_tabur|jumbo|Garlic|Sadis|': 40,
    'filling_tabur|jumbo|Garlic|Teriyaki|': 41,
    'filling_tabur|jumbo|Garlic|Lada Hitam|': 42,
    'filling_tabur|jumbo|Cheese|Barbeque Spicy|': 43,
    'filling_tabur|jumbo|Cheese|Sadis|': 44,
    'filling_tabur|jumbo|Cheese|Teriyaki|': 45,
    'filling_tabur|jumbo|Cheese|Lada Hitam|': 46,
    'filling_celup|regular|Mentai|Keju|': 47,
    'filling_celup|regular|Mentai|Balado|': 48,
    'filling_celup|regular|Mentai|Sweet Corn|': 49,
    'filling_celup|regular|Garlic|Keju|': 50,
    'filling_celup|regular|Garlic|Balado|': 51,
    'filling_celup|regular|Garlic|Sweet Corn|': 52,
    'filling_celup|regular|Cheese|Keju|': 53,
    'filling_celup|regular|Cheese|Balado|': 54,
    'filling_celup|regular|Cheese|Sweet Corn|': 55,
    'filling_celup|jumbo|Mentai|Keju|': 56,
    'filling_celup|jumbo|Mentai|Balado|': 57,
    'filling_celup|jumbo|Mentai|Sweet Corn|': 58,
    'filling_celup|jumbo|Garlic|Keju|': 59,
    'filling_celup|jumbo|Garlic|Balado|': 60,
    'filling_celup|jumbo|Garlic|Sweet Corn|': 61,
    'filling_celup|jumbo|Cheese|Keju|': 62,
    'filling_celup|jumbo|Cheese|Balado|': 63,
    'filling_celup|jumbo|Cheese|Sweet Corn|': 64,
  };
  return map[key] ?? 0;
}

/**
 * Pushes a completed transaction to Google Sheets.
 * Expects the Sheets endpoint to accept a JSON payload with:
 *   { order: { ... }, items: [ ... ] }
 */
export async function pushToSheets(
  endpoint: string,
  tx: Omit<Transaction, 'id' | 'order_number'> & { created_by: string }
): Promise<string | null> {
  if (!endpoint) return null;
  try {
    const payload = {
      order: {
        payment_method: tx.paymentMethod,
        price_tier: tx.priceTier,
        total: tx.grandTotal,
        created_by: tx.created_by,
        created_at: tx.timestamp,
      },
      items: tx.items.map(item => ({
        product_id: getProductId(item.variantId, item.size, item.filling, item.celup, item.tabur),
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.unitPrice * item.quantity,
      })),
    };

    // Send as URL-encoded form data (to avoid CORS preflight)
    const formData = new URLSearchParams();
    formData.append("payload", JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.warn("Sheets response not OK:", response.status);
      return null;
    }

    const result = await response.json();
    return result.orderNumber || null; // server returns the new invoice ID
  } catch (error) {
    console.error("Push to sheets failed:", error);
    return null;
  }
}

// ============================================================

export function formatRp(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

const USER_KEY = "ccr.user";

export async function saveUser(user: { username: string; display_name: string; role: string }): Promise<void> {
  await safeSetItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<{ username: string; display_name: string; role: string } | null> {
  try {
    const raw = await safeGetItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  try {
    if (useMemoryFallback) {
      memoryStore.delete(USER_KEY);
      return;
    }
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.warn("Failed to clear user:", error);
  }
}