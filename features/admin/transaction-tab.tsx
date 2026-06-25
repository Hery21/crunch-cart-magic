import { formatRp, loadTransactions } from "@/lib/pos-store";
import type { Transaction } from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import StatCard from "./stat-card";
import { filterTransactions, getTodayStats, type Range } from "./utils";

export default function TransactionTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [range, setRange] = useState<Range>("today");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTransactions().then(setTransactions);
  }, []);

  const filtered = useMemo(
    () => filterTransactions(transactions, range, search),
    [transactions, range, search],
  );
  const { todayTx, todaySales, avg } = useMemo(
    () => getTodayStats(transactions),
    [transactions],
  );

  return (
    <View style={{ gap: 14 }}>
      <View style={s.statsGrid}>
        <StatCard label="Penjualan Hari Ini" value={formatRp(todaySales)} />
        <StatCard label="Transaksi Hari Ini" value={String(todayTx.length)} />
        <StatCard label="Rata-rata Order" value={formatRp(avg)} />
      </View>

      <View style={s.filterBox}>
        <View style={s.rangeRow}>
          {(["today", "week", "all"] as Range[]).map((k) => {
            const labels: Record<Range, string> = {
              today: "Hari Ini",
              week: "Minggu Ini",
              all: "Semua",
            };
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setRange(k)}
                style={[s.rangePill, range === k && s.rangePillActive]}
              >
                <Text
                  style={[
                    s.rangePillText,
                    range === k && s.rangePillTextActive,
                  ]}
                >
                  {labels[k]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.searchRow}>
          <Ionicons
            name="search-outline"
            size={16}
            color={C.mutedFg}
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Cari ID atau produk..."
            placeholderTextColor={C.mutedFg}
          />
        </View>
      </View>

      <View style={s.txList}>
        {filtered.length === 0 ? (
          <Text style={s.emptyText}>Tidak ada transaksi.</Text>
        ) : (
          filtered.map((tx) => (
            <View key={tx.id} style={s.txCard}>
              <View style={s.txCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txId}>{tx.id}</Text>
                  <Text style={s.txTime}>
                    {new Date(tx.timestamp).toLocaleString("id-ID")}
                  </Text>
                  <Text style={s.txMeta}>
                    {tx.items.reduce((s, i) => s + i.quantity, 0)} item •{" "}
                    {tx.paymentMethod} •{" "}
                    {tx.priceTier === "kuantar" ? "Kuantar" : "Normal"}
                  </Text>
                </View>
                <Text style={s.txTotal}>{formatRp(tx.grandTotal)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  statsGrid: { gap: 8 },
  filterBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R["2xl"],
    backgroundColor: C.card,
    padding: 14,
    gap: 10,
  },
  rangeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rangePill: {
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.muted,
  },
  rangePillActive: { backgroundColor: C.primary },
  rangePillText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: C.mutedFg,
  },
  rangePillTextActive: { color: C.primaryFg },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingHorizontal: 10,
    backgroundColor: C.background,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
  },
  txList: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R["2xl"],
    backgroundColor: C.card,
    overflow: "hidden",
  },
  txCard: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  txCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  txId: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.mutedFg,
    fontVariant: ["tabular-nums"],
  },
  txTime: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.foreground,
  },
  txMeta: { fontFamily: "Poppins_400Regular", fontSize: 11, color: C.mutedFg },
  txTotal: { fontFamily: "Poppins_700Bold", fontSize: 14, color: C.primary },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    textAlign: "center",
    padding: 32,
  },
});
