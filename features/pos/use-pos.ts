import {
  type CatalogItem,
  fetchCatalog,
  loadCart,
  loadPayment,
  saveCart,
  savePayment,
} from "@/lib/pos-store";
import {
  type CartItem,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PriceTier,
  SHEETS_ENDPOINT,
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

/** Look up the price for a variant+size from the live Sheets catalog.
 * No catalog match means the combo isn't sold — treated as unavailable (0). */
function catalogPrice(
  catalog: CatalogItem[],
  variantId: VariantId,
  size: Size,
  tier: PriceTier,
): number {
  const variants = toCatalogVariants(variantId);
  const row = catalog.find(
    (r) => variants.includes(r.variant) && r.size === size,
  );
  if (!row) return 0;
  return tier === "kuantar" ? row.price_kuantar : row.price_normal;
}

export function usePos() {
  const [ready, setReady] = useState(false);
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
    loadCatalog(SHEETS_ENDPOINT);
    Promise.all([loadCart(), loadPayment()]).then(([c, p]) => {
      setCart(c);
      if (p) setPaymentMethod(p as PaymentMethod);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveCart(cart);
  }, [cart]);

  useEffect(() => {
    savePayment(paymentMethod);
  }, [paymentMethod]);

  const tier: PriceTier = tierForPayment(paymentMethod);

  /** Price for a variant+size at the current payment tier. */
  function priceFor(variantId: VariantId, size: Size): number {
    return catalogPrice(catalog, variantId, size, tier);
  }

  // Payment methods that would price any item currently in the cart at 0
  // (i.e. that variant+size isn't sold under that tier) — greyed out in the UI.
  const disabledPaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter((pm) => {
        const pmTier = tierForPayment(pm);
        return cart.some(
          (i) => catalogPrice(catalog, i.variantId, i.size, pmTier) <= 0,
        );
      }),
    [cart, catalog],
  );

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
    setCart((c) => {
      const match = c.find(
        (i) =>
          i.variantId === item.variantId &&
          i.size === item.size &&
          i.filling === item.filling &&
          i.celup === item.celup &&
          i.tabur === item.tabur,
      );
      if (match) {
        return c.map((i) =>
          i.id === match.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i,
        );
      }
      return [...c, item];
    });
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

  function updateItem(id: string, updatedItem: CartItem) {
    setCart((c) =>
      c.map((i) => (i.id === id ? updatedItem : i))
    );
  }

  function clearCart() {
    setCart([]);
  }

  function reloadCatalog() {
    loadCatalog(SHEETS_ENDPOINT, true);
  }

  return {
    ready,
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
    disabledPaymentMethods,
    tier,
    priceFor,
    addToCart,
    updateQty,
    removeItem,
    updateItem,
    clearCart,
  };
}
