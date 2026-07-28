import { Platform } from "react-native";

// ─── Imports ───────────────────────────────────────────────────────────────
import {
  DEFAULT_PRICES,
  DEFAULT_SETTINGS,
  type CartItem,
  type Settings,
  type Transaction,
} from "./pos-types";

// ─── AsyncStorage polyfill ──────────────────────────────────────────────
let AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;

if (Platform.OS === "web") {
  AsyncStorage = {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
    clear: async () => {
      try {
        localStorage.clear();
      } catch {}
    },
    getAllKeys: async () => {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    },
    multiGet: async (keys: string[]) => {
      return keys.map((key) => [key, localStorage.getItem(key) ?? null]);
    },
    multiSet: async (keyValuePairs: [string, string][]) => {
      keyValuePairs.forEach(([key, value]) => localStorage.setItem(key, value));
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => localStorage.removeItem(key));
    },
  } as any;
} else {
  const NativeAsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  AsyncStorage = NativeAsyncStorage;
}

const SETTINGS_KEY = "ccr.settings";
const TX_KEY = "ccr.transactions";
const CART_KEY = "ccr.cart";
const PAY_KEY = "ccr.payment";
const USER_KEY = "ccr.user";
const CATALOG_KEY = "ccr.product_catalog";

const memoryStore = new Map<string, string>();
let useMemoryFallback = false;

// ─── Storage helpers ──────────────────────────────────────────────────────
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

// ─── Settings ─────────────────────────────────────────────────────────────
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

// ─── Transactions ─────────────────────────────────────────────────────────
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

// ─── Cart ─────────────────────────────────────────────────────────────────
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

// ─── User ──────────────────────────────────────────────────────────────────
export async function saveUser(user: {
  username: string;
  display_name: string;
  role: string;
}): Promise<void> {
  await safeSetItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser(): Promise<{
  username: string;
  display_name: string;
  role: string;
} | null> {
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

// ─── Invoice ID ──────────────────────────────────────────────────────────
export async function nextInvoiceId(): Promise<string> {
  const settings = await loadSettings();
  const counter = (settings.invoiceCounter ?? 0) + 1;
  await saveSettings({ ...settings, invoiceCounter: counter });
  const d = new Date();
  const dateStr =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return `INV-${dateStr}-${String(counter).padStart(4, "0")}`;
}

// ─── Catalog (Single Source of Truth) ────────────────────────────────────

/** A single row from the product_variants sheet */
export interface CatalogItem {
  id: number;
  variant: string; // "original", "filling", "tabur", "celup", "filling_tabur", "filling_celup"
  size: "regular" | "jumbo";
  filling?: string;
  tabur?: string;
  celup?: string;
  price_normal: number;
  price_kuantar: number;
}

let catalogCache: CatalogItem[] | null = null;

/** Clears the in-memory catalog cache (and the AsyncStorage cache if needed). */
export function invalidateCatalogCache(): void {
  catalogCache = null;
}

/**
 * Fetches the catalog from Google Sheets.
 * Caches the result in memory and AsyncStorage.
 */
export async function fetchCatalog(
  endpoint: string,
  forceRefresh = false,
): Promise<CatalogItem[]> {
  if (!endpoint) return [];

  // Check memory cache
  if (!forceRefresh && catalogCache) return catalogCache;

  // Check AsyncStorage cache
  try {
    const cached = await safeGetItem(CATALOG_KEY);
    if (!forceRefresh && cached) {
      const parsed = JSON.parse(cached);
      // Validate it's actual catalog data (must have variant + price_normal fields)
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        "variant" in parsed[0] &&
        "price_normal" in parsed[0]
      ) {
        catalogCache = parsed;
        return parsed;
      }
    }
  } catch {}

  // Fetch from network
  try {
    const url = endpoint.includes("?")
      ? `${endpoint}&type=catalog`
      : `${endpoint}?type=catalog`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return [];
    // Validate the response is actually catalog data
    if (!("variant" in data[0]) || !("price_normal" in data[0])) return [];

    // Cache the result
    catalogCache = data;
    await safeSetItem(CATALOG_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Failed to fetch catalog:", error);
    return [];
  }
}

/**
 * Get product ID from catalog by matching variant + size + options.
 * This replaces the hardcoded getProductId().
 */
export function getProductIdFromCatalog(
  catalog: CatalogItem[],
  variantId: string,
  size: string,
  filling?: string,
  celup?: string,
  tabur?: string,
): number {
  // Handle alias variants (tabur_celup -> tabur or celup)
  let actualVariant = variantId;
  if (variantId === "tabur_celup") {
    if (tabur) actualVariant = "tabur";
    else if (celup) actualVariant = "celup";
  } else if (variantId === "filling_tabur_celup") {
    if (tabur) actualVariant = "filling_tabur";
    else if (celup) actualVariant = "filling_celup";
  }

  // Normalize empty strings to undefined for matching
  const matchFilling = filling || undefined;
  const matchCelup = celup || undefined;
  const matchTabur = tabur || undefined;

  const matched = catalog.find(
    (row) =>
      row.variant === actualVariant &&
      row.size === size &&
      (row.filling || undefined) === matchFilling &&
      (row.celup || undefined) === matchCelup &&
      (row.tabur || undefined) === matchTabur,
  );

  if (!matched) {
    console.warn(
      `⚠️ No catalog match for: ${actualVariant}|${size}|${filling || ""}|${celup || ""}|${tabur || ""}`,
    );
    return 0;
  }

  return matched.id;
}

/**
 * Get price from catalog by matching variant + size + options.
 * Returns { normal, kuantar } or null if not found.
 */
export function getPriceFromCatalog(
  catalog: CatalogItem[],
  variantId: string,
  size: string,
  filling?: string,
  celup?: string,
  tabur?: string,
): { normal: number; kuantar: number } | null {
  const id = getProductIdFromCatalog(
    catalog,
    variantId,
    size,
    filling,
    celup,
    tabur,
  );
  if (id === 0) return null;
  const row = catalog.find((r) => r.id === id);
  if (!row) return null;
  return { normal: row.price_normal, kuantar: row.price_kuantar };
}

// ─── Legacy getProductId (deprecated – kept for backward compatibility) ───
/** @deprecated Use getProductIdFromCatalog() with a fetched catalog instead. */
export function getProductId(
  variantId: string,
  size: string,
  filling?: string,
  celup?: string,
  tabur?: string,
): number {
  // This is a fallback – you should migrate to using the catalog.
  // The hardcoded map is removed to force migration.
  console.warn(
    "⚠️ getProductId() is deprecated. Use getProductIdFromCatalog() with a fetched catalog.",
  );
  return 0;
}

// ─── Push to Sheets ──────────────────────────────────────────────────────

/**
 * Pushes a completed transaction to Google Sheets.
 * Uses the catalog to resolve product IDs.
 */
export async function pushToSheets(
  endpoint: string,
  tx: Omit<Transaction, "id" | "order_number"> & { created_by: string },
  catalog?: CatalogItem[], // optional – if not provided, fetches it
): Promise<string | null> {
  if (!endpoint) return null;

  try {
    // Ensure we have a catalog
    let catalogData = catalog || catalogCache;
    if (!catalogData) {
      catalogData = await fetchCatalog(endpoint);
    }
    if (!catalogData || catalogData.length === 0) {
      console.warn("⚠️ No catalog available – cannot resolve product IDs");
      return null;
    }

    const payload = {
      order: {
        payment_method: tx.paymentMethod,
        price_tier: tx.priceTier,
        total: tx.grandTotal,
        created_by: tx.created_by,
        created_at: tx.timestamp,
      },
      items: tx.items.map((item) => {
        const productId = getProductIdFromCatalog(
          catalogData,
          item.variantId,
          item.size,
          item.filling,
          item.celup,
          item.tabur,
        );
        return {
          product_id: productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.unitPrice * item.quantity,
          variant_id: item.variantId,
          size: item.size,
          filling: item.filling || "",
          celup: item.celup || "",
          tabur: item.tabur || "",
          variant_name: item.variantName,
        };
      }),
    };

    const formData = new URLSearchParams();
    formData.append("payload", JSON.stringify(payload));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.warn("Sheets response not OK:", response.status);
      return null;
    }

    const result = await response.json();
    return result.orderNumber || null;
  } catch (error) {
    console.error("Push to sheets failed:", error);
    return null;
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────
export function formatRp(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

// ─── Sheets Fetch/Update (for PriceManager) ────────────────────────────

export async function updateCatalogPrices(
  endpoint: string,
  rows: any[],
): Promise<boolean> {
  if (!endpoint) return false;
  try {
    const payload = { type: "update_prices", prices: rows };
    const formData = new URLSearchParams();
    formData.append("payload", JSON.stringify(payload));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (result.success === true) {
      // Invalidate cache so next fetch gets fresh data
      invalidateCatalogCache();
      await safeSetItem(CATALOG_KEY, JSON.stringify(rows));
    }
    return result.success === true;
  } catch (error) {
    console.error("Failed to update prices:", error);
    return false;
  }
}

export async function fetchTransactionsFromSheets(
  endpoint: string,
): Promise<Transaction[]> {
  if (!endpoint) return [];
  try {
    const url = endpoint.includes("?")
      ? `${endpoint}&type=transactions`
      : `${endpoint}?type=transactions`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (data.error) return [];
    return data;
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return [];
  }
}
