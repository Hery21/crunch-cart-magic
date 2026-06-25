import CartSheet from "@/features/pos/cart-sheet";
import CustomizeModal from "@/features/pos/customize-modal";
import {
  ConfirmDialog,
  PayDialog,
  ReceiptDialog,
} from "@/features/pos/dialogs";
import MenuGrid from "@/features/pos/menu-grid";
import PosHeader from "@/features/pos/pos-header";
import { useClock } from "@/features/pos/use-clock";
import { usePos } from "@/features/pos/use-pos";
import {
  formatRp,
  nextInvoiceId,
  pushToSheets,
  saveTransaction,
} from "@/lib/pos-store";
import {
  type Transaction,
  type TransactionItem,
  type VariantId,
} from "@/lib/pos-types";
import { C } from "@/lib/theme";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PosScreen() {
  const clock = useClock();
  const pos = usePos();
  const [activeVariant, setActiveVariant] = useState<VariantId | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [feedback, setFeedback] = useState("");

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 2000);
  }

  async function confirmPay() {
    setSaving(true);
    const items: TransactionItem[] = pos.cartWithPrices.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      variantName: i.variantName,
      size: i.size,
      filling: i.filling,
      celup: i.celup,
      tabur: i.tabur,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      priceTier: i.priceTier,
    }));
    const tx = {
      id: await nextInvoiceId(),
      timestamp: new Date().toISOString(),
      items,
      subtotal: pos.subtotal,
      grandTotal: pos.grandTotal,
      paymentMethod: pos.paymentMethod,
      priceTier: pos.tier,
    };
    await saveTransaction(tx);
    if (pos.settings?.sheetsEndpoint)
      await pushToSheets(pos.settings.sheetsEndpoint, tx);
    setSaving(false);
    setConfirming(false);
    setPayOpen(false);
    pos.clearCart();
    setReceipt(tx as Transaction);
  }

  if (!pos.settings) {
    return (
      <View style={s.loading}>
        <Text style={s.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {!!feedback && (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{feedback}</Text>
        </View>
      )}

      <PosHeader
        clock={clock}
        paymentMethod={pos.paymentMethod}
        onChangePayment={pos.setPaymentMethod}
      />

      <MenuGrid
        tier={pos.tier}
        priceFor={pos.priceFor}
        onSelect={setActiveVariant}
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setCartOpen(true)}
        activeOpacity={0.9}
      >
        <Text style={s.fabText}>?? Keranjang ({pos.cartCount})</Text>
        <View style={s.fabBadge}>
          <Text style={s.fabBadgeText}>{formatRp(pos.grandTotal)}</Text>
        </View>
      </TouchableOpacity>

      <CartSheet
        visible={cartOpen}
        cart={pos.cartWithPrices}
        subtotal={pos.subtotal}
        tier={pos.tier}
        onUpdateQty={pos.updateQty}
        onRemove={pos.removeItem}
        onCheckout={() => {
          setCartOpen(false);
          setPayOpen(true);
        }}
        onClose={() => setCartOpen(false)}
      />

      {activeVariant && pos.settings && (
        <CustomizeModal
          variantId={activeVariant}
          prices={pos.settings.prices[activeVariant]}
          tier={pos.tier}
          onClose={() => setActiveVariant(null)}
          onAdd={(item) => {
            pos.addToCart(item);
            setActiveVariant(null);
            showFeedback("? Ditambahkan ke keranjang");
          }}
        />
      )}

      <PayDialog
        visible={payOpen}
        paymentMethod={pos.paymentMethod}
        tier={pos.tier}
        subtotal={pos.subtotal}
        grandTotal={pos.grandTotal}
        cartEmpty={pos.cartCount === 0}
        onChangePayment={pos.setPaymentMethod}
        onConfirm={() => setConfirming(true)}
        onClose={() => setPayOpen(false)}
      />

      <ConfirmDialog
        visible={confirming}
        saving={saving}
        cartCount={pos.cartCount}
        paymentMethod={pos.paymentMethod}
        tier={pos.tier}
        grandTotal={pos.grandTotal}
        onConfirm={confirmPay}
        onClose={() => setConfirming(false)}
      />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.background,
  },
  loadingText: { fontFamily: "Poppins_500Medium", color: C.mutedFg },
  toast: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    zIndex: 999,
    backgroundColor: C.foreground,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: { color: "#fff", fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  fab: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: C.warm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { fontFamily: "Poppins_700Bold", fontSize: 13, color: C.primaryFg },
  fabBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fabBadgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
    color: C.primaryFg,
  },
});
