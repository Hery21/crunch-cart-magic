import { formatRp } from "@/lib/pos-store";
import {
  SIZE_LABEL,
  type PaymentMethod,
  type PriceTier,
  type Transaction,
} from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PAYMENT_METHODS = [
  { id: "Cash" as const, icon: "wallet-outline", label: "Cash" },
  { id: "QRIS" as const, icon: "qr-code-outline", label: "QRIS" },
  { id: "Kuantar" as const, iconSet: "mci", icon: "bike", label: "Kuantar" },
];

interface PayDialogProps {
  visible: boolean;
  paymentMethod: PaymentMethod;
  tier: PriceTier;
  subtotal: number;
  grandTotal: number;
  cartEmpty: boolean;
  onChangePayment: (pm: PaymentMethod) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function PayDialog({
  visible,
  paymentMethod,
  tier,
  subtotal,
  grandTotal,
  cartEmpty,
  onChangePayment,
  onConfirm,
  onClose,
}: PayDialogProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          <Text style={s.title}>Konfirmasi Pembayaran</Text>
          <View style={s.pmGrid}>
            {PAYMENT_METHODS.map((pm) => {
              const active = paymentMethod === pm.id;
              return (
                <TouchableOpacity
                  key={pm.id}
                  onPress={() => onChangePayment(pm.id)}
                  style={[s.pmBtn, active && s.pmBtnActive]}
                >
                  {pm.iconSet === "mci" ? (
                    <MaterialCommunityIcons
                      name={pm.icon as "bike"}
                      size={24}
                      color={active ? C.primary : C.foreground}
                    />
                  ) : (
                    <Ionicons
                      name={pm.icon as "wallet-outline"}
                      size={24}
                      color={active ? C.primary : C.foreground}
                    />
                  )}
                  <Text style={[s.pmBtnText, active && s.pmBtnTextActive]}>
                    {pm.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.summaryBox}>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>
                Subtotal ({tier === "kuantar" ? "Kuantar" : "Normal"})
              </Text>
              <Text style={s.summaryValue}>{formatRp(subtotal)}</Text>
            </View>
            <View style={s.divider} />
            <View style={s.summaryRow}>
              <Text style={s.summaryLabelBold}>Grand Total</Text>
              <Text style={s.summaryValueBold}>{formatRp(grandTotal)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.btnPrimary, cartEmpty && s.btnDisabled]}
            onPress={() => !cartEmpty && onConfirm()}
          >
            <Text style={s.btnPrimaryText}>Bayar {formatRp(grandTotal)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={onClose}>
            <Text style={s.btnOutlineText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface ConfirmDialogProps {
  visible: boolean;
  saving: boolean;
  cartCount: number;
  paymentMethod: PaymentMethod;
  tier: PriceTier;
  grandTotal: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  visible,
  saving,
  cartCount,
  paymentMethod,
  tier,
  grandTotal,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => !saving && onClose()}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          <Text style={s.title}>Konfirmasi Transaksi</Text>
          <View style={{ gap: 6, marginBottom: 16 }}>
            <Text style={s.line}>
              Jumlah item: <Text style={s.bold}>{cartCount}</Text>
            </Text>
            <Text style={s.line}>
              Metode: <Text style={s.bold}>{paymentMethod}</Text>
            </Text>
            <Text style={s.line}>
              Tarif:{" "}
              <Text style={s.bold}>
                {tier === "kuantar" ? "Kuantar" : "Normal"}
              </Text>
            </Text>
            <Text style={s.line}>
              Total:{" "}
              <Text style={[s.bold, { color: C.primary }]}>
                {formatRp(grandTotal)}
              </Text>
            </Text>
          </View>
          <TouchableOpacity
            style={[s.btnPrimary, saving && s.btnDisabled]}
            onPress={() => !saving && onConfirm()}
          >
            <Text style={s.btnPrimaryText}>
              {saving ? "Menyimpan..." : "Konfirmasi"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.btnOutline}
            onPress={() => !saving && onClose()}
            disabled={saving}
          >
            <Text style={s.btnOutlineText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface ReceiptDialogProps {
  receipt: Transaction | null;
  onClose: () => void;
}

export function ReceiptDialog({ receipt, onClose }: ReceiptDialogProps) {
  return (
    <Modal
      visible={!!receipt}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.dialog}>
          <Text style={s.title}>Struk Pembayaran</Text>
          {receipt && (
            <View style={s.receipt}>
              <Text
                style={[
                  s.receiptText,
                  { fontFamily: "Poppins_700Bold", textAlign: "center" },
                ]}
              >
                CHICKEN CRUNCHY ROLL
              </Text>
              <Text style={[s.receiptText, { textAlign: "center" }]}>
                {new Date(receipt.timestamp).toLocaleString("id-ID")}
              </Text>
              <Text style={[s.receiptText, { textAlign: "center" }]}>
                #{receipt.id}
              </Text>
              <Text
                style={[
                  s.receiptText,
                  {
                    textAlign: "center",
                    fontSize: 9,
                    textTransform: "uppercase",
                  },
                ]}
              >
                Tarif {receipt.priceTier === "kuantar" ? "Kuantar" : "Normal"}
              </Text>
              <View style={s.receiptDivider} />
              {receipt.items.map((i) => (
                <View key={i.id} style={{ marginBottom: 4 }}>
                  <View style={s.receiptRow}>
                    <Text style={s.receiptText}>
                      {i.variantName} ({SIZE_LABEL[i.size]}) x{i.quantity}
                    </Text>
                    <Text style={s.receiptText}>
                      {formatRp(i.unitPrice * i.quantity)}
                    </Text>
                  </View>
                  {(i.filling || i.celup || i.tabur) && (
                    <Text style={[s.receiptText, { color: C.mutedFg }]}>
                      {[i.filling, i.celup, i.tabur].filter(Boolean).join(", ")}
                    </Text>
                  )}
                </View>
              ))}
              <View style={s.receiptDivider} />
              <View style={s.receiptRow}>
                <Text
                  style={[s.receiptText, { fontFamily: "Poppins_700Bold" }]}
                >
                  TOTAL
                </Text>
                <Text
                  style={[s.receiptText, { fontFamily: "Poppins_700Bold" }]}
                >
                  {formatRp(receipt.grandTotal)}
                </Text>
              </View>
              <View style={s.receiptRow}>
                <Text style={s.receiptText}>Bayar</Text>
                <Text style={s.receiptText}>{receipt.paymentMethod}</Text>
              </View>
              <View style={s.receiptDivider} />
              <Text style={[s.receiptText, { textAlign: "center" }]}>
                Terima kasih 🙏
              </Text>
            </View>
          )}
          <TouchableOpacity style={s.btnPrimary} onPress={onClose}>
            <Text style={s.btnPrimaryText}>Selesai</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
  },
  dialog: {
    backgroundColor: C.card,
    borderRadius: R["2xl"],
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 17,
    color: C.foreground,
    marginBottom: 16,
  },
  pmGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pmBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 12,
  },
  pmBtnActive: { borderColor: C.primary, backgroundColor: C.accent },
  pmBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.foreground,
  },
  pmBtnTextActive: { color: C.primary },
  summaryBox: {
    backgroundColor: C.muted,
    borderRadius: R.xl,
    padding: 14,
    gap: 6,
    marginBottom: 14,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
  },
  summaryLabelBold: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: C.primary,
  },
  summaryValue: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
  },
  summaryValueBold: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: C.primary,
  },
  divider: { height: 1, backgroundColor: C.border },
  line: { fontFamily: "Poppins_400Regular", fontSize: 13, color: C.foreground },
  bold: { fontFamily: "Poppins_700Bold" },
  btnPrimary: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  btnPrimaryText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: C.primaryFg,
  },
  btnDisabled: { opacity: 0.5 },
  btnOutline: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnOutlineText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: C.foreground,
  },
  receipt: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: C.border,
    paddingVertical: 12,
    marginBottom: 16,
  },
  receiptText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.foreground,
  },
  receiptRow: { flexDirection: "row", justifyContent: "space-between" },
  receiptDivider: {
    height: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: C.border,
    marginVertical: 6,
  },
});
