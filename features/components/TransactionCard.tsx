// components/TransactionCard.tsx
import { formatRp } from "@/lib/pos-store";
import type { Transaction } from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  transaction: Transaction;
}

export default function TransactionCard({ transaction }: Props) {
  const date = new Date(transaction.timestamp);
  const timeStr = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View style={s.card}>
      <View
        style={[
          s.header,
          { flexDirection: "row", justifyContent: "space-between" },
        ]}
      >
        <Text style={s.invoiceId}>{transaction.id}</Text>
        <Text style={s.timestamp}>
          {dateStr} • {timeStr}
        </Text>
      </View>

      <View style={s.itemList}>
        {transaction.items.map((it, idx) => (
          <View key={it.id ?? idx} style={s.itemRow}>
            <Text style={s.itemName}>
              {it.quantity}x {it.size === "jumbo" ? "Jumbo" : "Regular"} -{" "}
              {it.variantName}
              {/* {it.filling ? `, ${it.filling}` : ""}
              {it.celup ? `, celup ${it.celup}` : ""}
              {it.tabur ? `, tabur ${it.tabur}` : ""} */}
            </Text>
            <Text style={s.itemTotal}>
              {formatRp(it.unitPrice * it.quantity)}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.footer}>
        <Text style={s.totalLabel}>Total</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={s.badgeRow}>
            <View
              style={[
                s.badge,
                transaction.priceTier === "kuantar"
                  ? s.badgeOrange
                  : s.badgeEmerald,
              ]}
            >
              <Text
                style={[
                  s.badgeText,
                  transaction.priceTier === "kuantar"
                    ? s.badgeOrangeText
                    : s.badgeEmeraldText,
                ]}
              >
                {transaction.priceTier === "kuantar" ? "KUANTAR" : "NORMAL"}
              </Text>
            </View>
            <View style={s.badgePayment}>
              <Text style={s.badgePaymentText}>
                {transaction.paymentMethod}
              </Text>
            </View>
          </View>
          <Text style={s.totalAmount}>{formatRp(transaction.grandTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  invoiceId: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: C.foreground,
  },
  timestamp: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.mutedFg,
    marginTop: 1,
  },
  badgeRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  badge: {
    borderRadius: R.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: "Poppins_700Bold", fontSize: 9 },
  badgeOrange: { backgroundColor: C.orange },
  badgeOrangeText: { color: C.orangeText },
  badgeEmerald: { backgroundColor: C.emerald },
  badgeEmeraldText: { color: C.emeraldText },
  badgePayment: {
    backgroundColor: C.accent,
    borderRadius: R.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePaymentText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    color: C.primary,
  },
  itemList: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemName: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.foreground,
    marginRight: 8,
  },
  itemTotal: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.foreground,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  totalLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: C.mutedFg,
  },
  totalAmount: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 16,
    color: C.primary,
  },
});
