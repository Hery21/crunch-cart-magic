import {
  type CatalogItem,
  fetchCatalog,
  loadCart,
  loadPayment,
  loadSettings,
  saveCart,
  savePayment,
} from "@/lib/pos-store";
import {
  type CartItem,
  DEFAULT_PRICES,
  type PaymentMethod,
  type PriceTier,
  type Settings,
  type Size,
  type VariantId,
  tierForPayment,
} from "@/lib/pos-types";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface PricedCartItem extends CartItem {
  unitPrice: number;
  priceTier: PriceTier;
}

/** Map an app VariantId to one or more catalog variant strings. */
function toCatalogVariants(variantId: VariantId): string[] {
  if (variantId === "tabur_celup") return ["tabur", "celup"];
  if (variantId === "filling_tabur_celup")
    return ["filling_tabur", "filling_celup"];
  return [variantId];
}

/** Look up the price for a variant+size from the catalog, falling back to DEFAULT_PRICES. */
function catalogPrice(
  catalog: CatalogItem[],
  variantId: VariantId,
  size: Size,
  tier: PriceTier,
): number {
  if (catalog.length > 0) {
    const variants = toCatalogVariants(variantId);
    const row = catalog.find(
      (r) => variants.includes(r.variant) && r.size === size,
    );
    if (row) return tier === "kuantar" ? row.price_kuantar : row.price_normal;
  }
  // Fallback to DEFAULT_PRICES when catalog is unavailable
  return DEFAULT_PRICES[variantId]?.[size]?.[tier] ?? 0;
}

export function usePos() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");

  const loadCatalog = useCallback(async (endpoint: string, force = false) => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await fetchCatalog(endpoint, force);
      if (data.length > 0) {
        setCatalog(data);
      } else {
        setCatalogError("Katalog kosong – periksa koneksi atau endpoint");
      }
    } catch {
      setCatalogError("Gagal memuat katalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadCart(), loadPayment()]).then(
      ([s, c, p]) => {
        setSettings(s);
        setCart(c);
        if (p) setPaymentMethod(p as PaymentMethod);
        if (s.sheetsEndpoint) {
          loadCatalog(s.sheetsEndpoint);
        } else {
          setCatalogLoading(false);
          setCatalogError("Sheets endpoint belum dikonfigurasi");
        }
      },
    );
  }, []);

  useEffect(() => {
    if (settings) saveCart(cart);
  }, [cart]);

  useEffect(() => {
    savePayment(paymentMethod);
  }, [paymentMethod]);

  const tier: PriceTier = tierForPayment(paymentMethod);

  /** Price for a variant+size at the current payment tier. */
  function priceFor(variantId: VariantId, size: Size): number {
    return catalogPrice(catalog, variantId, size, tier);
  }

  const cartWithPrices = useMemo<PricedCartItem[]>(
    () =>
      cart.map((i) => ({
        ...i,
        unitPrice: catalogPrice(catalog, i.variantId, i.size, tier),
        priceTier: tier,
      })),
    [cart, catalog, tier],
  );

  const subtotal = useMemo(
    () => cartWithPrices.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [cartWithPrices],
  );

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  function addToCart(item: CartItem) {
    setCart((c) => [...c, item]);
  }

  function updateQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  }

  function removeItem(id: string) {
    setCart((c) => c.filter((i) => i.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  function reloadCatalog() {
    if (settings?.sheetsEndpoint) {
      loadCatalog(settings.sheetsEndpoint, true);
    }
  }

  return {
    settings,
    catalog,
    catalogLoading,
    catalogError,
    reloadCatalog,
    cart,
    cartWithPrices,
    cartCount,
    subtotal,
    grandTotal: subtotal,
    paymentMethod,
    setPaymentMethod,
    tier,
    priceFor,
    addToCart,
    updateQty,
    removeItem,
    clearCart,
  };
}
