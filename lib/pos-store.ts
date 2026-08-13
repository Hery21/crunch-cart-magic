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

// ─── URL helper (SINGLE SOURCE OF TRUTH for building GET URLs) ─────────────
/**
 * Builds a GET URL from the base endpoint by appending query params.
 * IMPORTANT: This does NOT change the base/host of `endpoint`. It only appends
 * a query string. Any `script.googleusercontent.com/macros/echo` URL you see in
 * the console is Google's *own* redirect target for serving GET output — it is
 * NOT produced here.
 *
 * @param endpoint  The exact web-app URL (…/exec). Must be identical to the one
 *                  used by pushToSheets().
 * @param params    Query params to append (e.g. { type: "catalog" }).
 * @param cacheBust When true, appends a timestamp to defeat CDN/proxy caching.
 */
function buildGetUrl(
  endpoint: string,
  params: Record<string, string>,
  cacheBust = true,
): string {
  const trimmed = (endpoint ?? "").trim();
  const all: Record<string, string> = { ...params };
  if (cacheBust) all._t = String(Date.now());

  const qs = Object.entries(all)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  return trimmed.includes("?") ? `${trimmed}&${qs}` : `${trimmed}?${qs}`;
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
    const merged: Settings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      prices: migrated as Settings["prices"],
    };
    // Normalize the endpoint so GET and POST are guaranteed identical.
    merged.sheetsEndpoint = (merged.sheetsEndpoint ?? "").trim();
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  // Trim on save too, so we never persist stray whitespace/newlines.
  const clean: Settings = {
    ...s,
    sheetsEndpoint: (s.sheetsEndpoint ?? "").trim(),
  };
  await safeSetItem(SETTINGS_KEY, JSON.stringify(clean));
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
 * Caches in memory only (no localStorage) so prices reflect sheet changes on every fresh page load.
 */
export async function fetchCatalog(
  endpoint: string,
  forceRefresh = false,
): Promise<CatalogItem[]> {
  // ── DEBUG: log the raw endpoint so we can compare with pushToSheets ──
  console.log("🟦 [fetchCatalog] endpoint arg:", JSON.stringify(endpoint));
  console.log("🟦 [fetchCatalog] forceRefresh:", forceRefresh);

  if (!endpoint) {
    console.warn("🟥 [fetchCatalog] Empty endpoint — returning []");
    return [];
  }

  // Check memory cache
  if (!forceRefresh && catalogCache) {
    console.log(
      "🟩 [fetchCatalog] returning MEMORY cache",
      catalogCache.length,
    );
    return catalogCache;
  }

  // No localStorage cache for catalog — prices must be fresh on every page load.

  // Fetch from network
  try {
    // Built via the SAME helper, from the SAME endpoint string.
    const url = buildGetUrl(endpoint, { type: "catalog" });

    console.log("🟦 [fetchCatalog] FINAL GET url:", url);

    const response = await fetch(url, {
      method: "GET",
      // Follow Google's 302 redirect to script.googleusercontent.com.
      // Note: No custom headers here — adding any non-simple header (e.g.
      // Cache-Control) triggers a CORS preflight OPTIONS that Google Apps
      // Script does not handle, causing ERR_FAILED on web.
      // Cache-busting is handled by the _t timestamp in the URL instead.
      redirect: "follow",
    });

    // ── DEBUG: log exactly what came back, including the FINAL (redirected) URL ──
    console.log(
      "🟦 [fetchCatalog] response.status:",
      response.status,
      "| response.ok:",
      response.ok,
      "| final url:",
      response.url, // <-- this will show the googleusercontent echo URL
      "| redirected:",
      (response as any).redirected,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "<no body>");
      console.error(
        "🟥 [fetchCatalog] HTTP not OK:",
        response.status,
        "body:",
        text.slice(0, 500),
      );
      return [];
    }

    const raw = await response.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      // If doGet returned HTML (login page / error page) instead of JSON,
      // this is where you'll catch it. Log the first chunk to diagnose.
      console.error(
        "🟥 [fetchCatalog] Response was not JSON. First 500 chars:",
        raw.slice(0, 500),
      );
      return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.warn("🟨 [fetchCatalog] Empty / non-array payload:", data);
      return [];
    }

    if (!("variant" in data[0]) || !("price_normal" in data[0])) {
      console.warn(
        "🟨 [fetchCatalog] Payload shape unexpected (missing variant/price_normal):",
        data[0],
      );
      return [];
    }

    catalogCache = data;
    console.log("🟩 [fetchCatalog] NETWORK success, rows:", data.length);
    return data;
  } catch (error) {
    console.error("🟥 [fetchCatalog] Failed to fetch catalog:", error);
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
  let actualVariant = variantId;
  if (variantId === "tabur_celup") {
    if (tabur) actualVariant = "tabur";
    else if (celup) actualVariant = "celup";
  } else if (variantId === "filling_tabur_celup") {
    if (tabur) actualVariant = "filling_tabur";
    else if (celup) actualVariant = "filling_celup";
  }

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
  catalog?: CatalogItem[],
): Promise<string | null> {
  // ── DEBUG: log the endpoint so we can compare it with fetchCatalog ──
  console.log("🟪 [pushToSheets] endpoint arg:", JSON.stringify(endpoint));

  if (!endpoint) return null;
  try {
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

    const response = await fetch(endpoint.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      redirect: "follow",
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

    const response = await fetch(endpoint.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      redirect: "follow",
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (result.success === true) {
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
    const url = buildGetUrl(endpoint, { type: "transactions" });
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (data.error) return [];
    return data;
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return [];
  }
}
