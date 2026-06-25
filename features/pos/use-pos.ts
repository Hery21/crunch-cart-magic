import {
  loadCart,
  loadPayment,
  loadSettings,
  saveCart,
  savePayment,
} from "@/lib/pos-store";
import {
  type CartItem,
  type PaymentMethod,
  type PriceTier,
  type Settings,
  type Size,
  type VariantId,
  tierForPayment,
} from "@/lib/pos-types";
import { useEffect, useMemo, useState } from "react";

export interface PricedCartItem extends CartItem {
  unitPrice: number;
  priceTier: PriceTier;
}

export function usePos() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");

  useEffect(() => {
    Promise.all([loadSettings(), loadCart(), loadPayment()]).then(
      ([s, c, p]) => {
        setSettings(s);
        setCart(c);
        if (p) setPaymentMethod(p as PaymentMethod);
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

  function priceFor(
    variantId: VariantId,
    size: Size,
    t: PriceTier = tier,
  ): number {
    return settings?.prices[variantId]?.[size]?.[t] ?? 0;
  }

  const cartWithPrices = useMemo<PricedCartItem[]>(
    () =>
      cart.map((i) => ({
        ...i,
        unitPrice: priceFor(i.variantId, i.size),
        priceTier: tier,
      })),
    [cart, settings, tier],
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

  return {
    settings,
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
