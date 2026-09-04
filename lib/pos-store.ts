import { Platform } from "react-native";
// ─── Imports ───────────────────────────────────────────────────────────────
import { type CartItem, type Transaction } from "./pos-types";

// ─── AsyncStorage polyfill ──────────────────────────────────────────────
// On web, reuse the single WebAsyncStorage instance registered by web-polyfill.js
// instead of redefining another localStorage wrapper here.
let AsyncStorage: typeof import("@react-native-async-storage/async-storage").default;
if (Platform.OS === "web") {
  AsyncStorage = (globalThis as any).__REACT_NATIVE_ASYNC_STORAGE__;
} else {
  const NativeAsyncStorage =
    require("@react-native-async-storage/async-storage").default;
  AsyncStorage = NativeAsyncStorage;
}

const INVOICE_COUNTER_KEY = "ccr.invoiceCounter";
const CART_KEY = "ccr.cart";
const PAY_KEY = "ccr.payment";
const USER_KEY = "ccr.user";

// Keys used by older builds that are no longer needed (sheetsEndpoint is now a
// fixed constant, and transactions are read straight from Google Sheets).
const LEGACY_KEYS = ["ccr.settings", "ccr.transactions"];

const memoryStore = new Map<string, string>();
let useMemoryFallback = false;

/** Removes obsolete AsyncStorage keys left over from older app versions. */
export async function clearLegacyStorage(): Promise<void> {
  try {
    await Promise.all(LEGACY_KEYS.map((key) => AsyncStorage.removeItem(key)));
  } catch {
    // best-effort cleanup only
  }
}

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

// ─── GAS retry helper ────────────────────────────────────────────────────────
/**
 * Calls `fetcher` up to GAS_MAX_ATTEMPTS times, waiting GAS_RETRY_DELAY_MS *
 * attempt between retries. Handles both network errors and non-OK HTTP statuses.
 * Returns null when all attempts fail.
 *
 * NOTE: Only use this for idempotent requests (GET, or PUT/POST that are safe
 * to repeat). Do NOT use for pushToSheets order submission — that would create
 * duplicate orders.
 */
const GAS_MAX_ATTEMPTS = 3;
const GAS_RETRY_DELAY_MS = 1200;

async function gasWithRetry(
  fetcher: () => Promise<Response>,
  label: string,
): Promise<Response | null> {
  for (let attempt = 1; attempt <= GAS_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetcher();
      if (response.ok) return response;
      console.warn(
        `[${label}] attempt ${attempt}/${GAS_MAX_ATTEMPTS} HTTP ${response.status}`,
      );
    } catch (error) {
      console.warn(
        `[${label}] attempt ${attempt}/${GAS_MAX_ATTEMPTS} threw:`,
        error,
      );
    }
    if (attempt < GAS_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, GAS_RETRY_DELAY_MS * attempt));
    }
  }
  console.error(`[${label}] all attempts failed`);
  return null;
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
  const raw = await safeGetItem(INVOICE_COUNTER_KEY);
  const counter = (Number(raw) || 0) + 1;
  await safeSetItem(INVOICE_COUNTER_KEY, String(counter));
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

  const url = buildGetUrl(endpoint, { type: "catalog" });
  const response = await gasWithRetry(
    () => fetch(url, { method: "GET", redirect: "follow" }),
    "fetchCatalog",
  );
  if (!response) return [];

  let data: any;
  try {
    data = await response.json();
  } catch {
    console.error("🟥 [fetchCatalog] response was not JSON");
    return [];
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.warn("🟨 [fetchCatalog] empty or non-array payload:", data);
    return [];
  }

  if (!("variant" in data[0]) || !("price_normal" in data[0])) {
    console.warn("🟨 [fetchCatalog] unexpected shape:", data[0]);
    return [];
  }

  catalogCache = data;
  console.log("🟩 [fetchCatalog] success, rows:", data.length);
  return data;
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

// ─── Device-local timestamps (always WIB / +07:00, never UTC) ────────────
/** Current device time formatted with an explicit +07:00 offset (no UTC conversion). */
export function nowLocalISOString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+07:00`
  );
}

/** Local (device) date key "YYYY-MM-DD", independent of the string's embedded offset. */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

    const response = await gasWithRetry(
      () =>
        fetch(endpoint.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          redirect: "follow",
        }),
      "updateCatalogPrices",
    );
    if (!response) return false;
    const result = await response.json();
    if (result.success === true) {
      invalidateCatalogCache();
    }
    return result.success === true;
  } catch (error) {
    console.error("Failed to update prices:", error);
    return false;
  }
}

// ─── Users (Admin management via Google Sheets) ────────────────────────────
export interface AppUser {
  id: number;
  username: string;
  // Never populated from the server; only sent when setting/changing a PIN.
  password?: string;
  display_name: string;
  role: string;
}

let usersCache: AppUser[] | null = null;

function invalidateUsersCache(): void {
  usersCache = null;
}

export async function fetchUsers(
  endpoint: string,
  forceRefresh = false,
): Promise<AppUser[]> {
  if (!endpoint) return [];
  if (!forceRefresh && usersCache) return usersCache;

  const url = buildGetUrl(endpoint, { type: "users" });
  const response = await gasWithRetry(
    () => fetch(url, { method: "GET", redirect: "follow" }),
    "fetchUsers",
  );
  if (!response) return [];

  let data: any;
  try {
    data = await response.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  usersCache = data;
  return data;
}

async function postUserAction(
  endpoint: string,
  payload: object,
): Promise<boolean> {
  if (!endpoint) return false;
  try {
    const formData = new URLSearchParams();
    formData.append("payload", JSON.stringify(payload));

    const response = await gasWithRetry(
      () =>
        fetch(endpoint.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          redirect: "follow",
        }),
      "postUserAction",
    );
    if (!response) return false;
    const result = await response.json();
    if (result.success === true) invalidateUsersCache();
    return result.success === true;
  } catch (error) {
    console.error("Failed to sync user:", error);
    return false;
  }
}

export async function addUser(
  endpoint: string,
  user: Omit<AppUser, "id">,
): Promise<boolean> {
  return postUserAction(endpoint, { type: "add_user", user });
}

export async function updateUser(
  endpoint: string,
  user: AppUser,
): Promise<boolean> {
  return postUserAction(endpoint, { type: "update_user", user });
}

export async function deleteUser(
  endpoint: string,
  id: number,
): Promise<boolean> {
  return postUserAction(endpoint, { type: "delete_user", id });
}

// Verifies the PIN server-side; the raw/hashed password never reaches the client.
export async function loginUser(
  endpoint: string,
  pin: string,
): Promise<Omit<AppUser, "password"> | null> {
  if (!endpoint) return null;
  try {
    const formData = new URLSearchParams();
    formData.append("payload", JSON.stringify({ type: "login", pin }));

    const response = await gasWithRetry(
      () =>
        fetch(endpoint.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          redirect: "follow",
        }),
      "loginUser",
    );
    if (!response) return null;
    const result = await response.json();
    return result.success ? result.user : null;
  } catch (error) {
    console.error("Failed to login:", error);
    return null;
  }
}

export async function fetchTransactionsFromSheets(
  endpoint: string,
): Promise<Transaction[]> {
  if (!endpoint) return [];
  try {
    const url = buildGetUrl(endpoint, { type: "transactions" });
    const response = await gasWithRetry(
      () => fetch(url, { method: "GET", redirect: "follow" }),
      "fetchTransactions",
    );
    if (!response) return [];
    const data = await response.json();
    if (data.error) return [];
    return sortTransactionsByDateDesc(data);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return [];
  }
}

function sortTransactionsByDateDesc(list: Transaction[]): Transaction[] {
  return [...list].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// Soft-deletes a transaction on the backend (sets isDeleted = true, row is kept).
export async function deleteTransaction(
  endpoint: string,
  id: string,
): Promise<boolean> {
  if (!endpoint) return false;
  try {
    const formData = new URLSearchParams();
    formData.append(
      "payload",
      JSON.stringify({ type: "delete_transaction", id }),
    );

    const response = await gasWithRetry(
      () =>
        fetch(endpoint.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
          redirect: "follow",
        }),
      "deleteTransaction",
    );
    if (!response) return false;
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return false;
  }
}
