// features/pos/transaction-tab.tsx
import { formatRp, loadTransactions } from "@/lib/pos-store";
import type { PaymentMethod, Transaction } from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TransactionCard from "../components/TransactionCard";

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "QRIS", "Kuantar"];

export default function TransactionTab() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | "">(
    "",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"start" | "end">("start");

  useEffect(() => {
    loadTransactions().then(setAllTransactions);
  }, []);

  const toDateString = (d: Date | null): string =>
    d ? d.toISOString().slice(0, 10) : "";

  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowPicker(false);
    if (selected) {
      if (pickerMode === "start") setStartDate(selected);
      else setEndDate(selected);
    }
  };

  const filtered = useMemo(() => {
    let result = allTransactions;
    if (startStr || endStr) {
      result = result.filter((tx) => {
        const txDate = new Date(tx.timestamp).toISOString().slice(0, 10);
        if (startStr && txDate < startStr) return false;
        if (endStr && txDate > endStr) return false;
        return true;
      });
    }
    if (selectedPayment) {
      result = result.filter((tx) => tx.paymentMethod === selectedPayment);
    }
    return result;
  }, [allTransactions, startStr, endStr, selectedPayment]);

  const totalRevenue = filtered.reduce((sum, tx) => sum + tx.grandTotal, 0);
  const totalOrders = filtered.length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      stickyHeaderIndices={[0]} // makes the first child sticky
      showsVerticalScrollIndicator={false}
    >
      {/* Sticky header: summary + filter */}
      <View style={s.stickyHeader}>
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

        <View style={s.filterContainer}>
          <Text style={s.filterLabel}>Rentang Tanggal</Text>
          <View style={s.dateRow}>
            <TouchableOpacity
              style={s.dateButton}
              onPress={() => {
                setPickerMode("start");
                setShowPicker(true);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={startDate ? C.foreground : C.mutedFg}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.dateButtonText, !startDate && s.placeholder]}>
                {startDate?.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) ?? "Dari"}
              </Text>
            </TouchableOpacity>
            <Text style={s.dateSeparator}>–</Text>
            <TouchableOpacity
              style={s.dateButton}
              onPress={() => {
                setPickerMode("end");
                setShowPicker(true);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={endDate ? C.foreground : C.mutedFg}
                style={{ marginRight: 4 }}
              />
              <Text style={[s.dateButtonText, !endDate && s.placeholder]}>
                {endDate?.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) ?? "Sampai"}
              </Text>
            </TouchableOpacity>
          </View>
          {showPicker && (
            <DateTimePicker
              value={
                pickerMode === "start"
                  ? (startDate ?? new Date())
                  : (endDate ?? new Date())
              }
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
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
                  style={[
                    s.pillText,
                    selectedPayment === pm && s.pillTextActive,
                  ]}
                >
                  {pm}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Transaction list (non‑sticky) */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={48} color={C.mutedFg} />
          <Text style={s.emptyText}>Tidak ada transaksi.</Text>
        </View>
      ) : (
        filtered.map((tx) => <TransactionCard key={tx.id} transaction={tx} />)
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  stickyHeader: {
    backgroundColor: C.background, // opaque so content doesn't show through
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
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
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
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
    marginBottom: 4,
    marginTop: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateButtonText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.foreground,
  },
  placeholder: { color: C.mutedFg },
  dateSeparator: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.mutedFg,
  },
  paymentPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillActive: {
    borderColor: C.primary,
    backgroundColor: C.accent,
  },
  pillText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: C.foreground,
  },
  pillTextActive: { color: C.primary },
  empty: {
    alignItems: "center",
    marginTop: 64,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: C.mutedFg,
    textAlign: "center",
    padding: 32,
  },
});
