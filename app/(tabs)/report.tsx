// app/report.tsx
import TransactionCard from "@/features/components/TransactionCard";
import { formatRp, loadTransactions } from "@/lib/pos-store";
import type { PaymentMethod, Transaction } from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "QRIS", "Kuantar"];

export default function ReportScreen() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | "">(
    "",
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await loadTransactions();
        setAllTransactions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      if (selectedPayment && tx.paymentMethod !== selectedPayment) return false;
      return true;
    });
  }, [allTransactions, selectedPayment]);

  const totalRevenue = filteredTransactions.reduce(
    (sum, tx) => sum + tx.grandTotal,
    0,
  );
  const totalOrders = filteredTransactions.length;

  if (loading) {
    return (
      <SafeAreaView style={s.centered} edges={["top"]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Memuat laporan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header – compact */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Laporan Penjualan</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Filter Section – compact */}
      <View style={s.filterContainer}>
        <Text style={s.filterLabel}>Metode Pembayaran</Text>
        <View style={s.paymentPills}>
          <TouchableOpacity
            style={[s.pill, selectedPayment === "" && s.pillActive]}
            onPress={() => setSelectedPayment("")}
          >
            <Text
              style={[s.pillText, selectedPayment === "" && s.pillTextActive]}
            >
              Semua
            </Text>
          </TouchableOpacity>
          {PAYMENT_METHODS.map((pm) => (
            <TouchableOpacity
              key={pm}
              style={[s.pill, selectedPayment === pm && s.pillActive]}
              onPress={() => setSelectedPayment(pm)}
            >
              <Text
                style={[s.pillText, selectedPayment === pm && s.pillTextActive]}
              >
                {pm}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary Cards – compact */}
      <View style={s.summaryRow}>
        <View style={s.summaryCard}>
          <Text style={s.summaryValue}>{totalOrders}</Text>
          <Text style={s.summaryLabel}>Transaksi</Text>
        </View>
        <View style={s.summaryCard}>
          <Text style={[s.summaryValue, { color: C.primary }]}>
            {formatRp(totalRevenue)}
          </Text>
          <Text style={s.summaryLabel}>Pendapatan</Text>
        </View>
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionCard transaction={item} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={48} color={C.mutedFg} />
            <Text style={s.emptyText}>Belum ada transaksi</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  centered: {
    flex: 1,
    backgroundColor: C.background,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.mutedFg,
  },
  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  backBtn: { padding: 2 },
  headerTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: C.foreground,
  },
  // ── Filter ──
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  filterLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: C.mutedFg,
    marginBottom: 5,
    marginTop: 6,
  },
  paymentPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 6,
  },
  pill: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillActive: { borderColor: C.primary, backgroundColor: C.accent },
  pillText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: C.foreground,
  },
  pillTextActive: { color: C.primary },
  // ── Summary ──
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: C.foreground,
  },
  summaryLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.mutedFg,
    marginTop: 2,
  },
  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    alignItems: "center",
    marginTop: 64,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: C.mutedFg,
  },
});
