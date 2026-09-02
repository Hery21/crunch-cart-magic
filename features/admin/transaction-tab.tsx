// features/pos/transaction-tab.tsx
import {
  deleteTransaction,
  fetchTransactionsFromSheets,
  formatRp,
  loadSettings,
  loadTransactions,
  toLocalDateKey,
} from "@/lib/pos-store";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type Transaction,
} from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TransactionCard from "../components/TransactionCard";

/** Renders a native <input type="date"> on web so the browser date picker works. */
function WebDateInput({
  value,
  onChange,
  placeholder,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder: string;
}) {
  return createElement("input", {
    type: "date",
    value: value ? toLocalDateKey(value) : "",
    placeholder,
    onChange: (e: any) =>
      onChange(e.target.value ? new Date(e.target.value + "T12:00:00") : null),
    style: {
      flex: 1,
      border: "none",
      background: "transparent",
      outline: "none",
      fontSize: 12,
      fontFamily: "inherit",
      cursor: "pointer",
      color: value ? "inherit" : "#9ca3af",
      width: "100%",
      minWidth: 0,
    },
  });
}

export default function TransactionTab() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | "">(
    "",
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"start" | "end">("start");
  const [endpoint, setEndpoint] = useState("");

  // ============================================================
  // Fetch transactions from Google Sheets (or fallback to local)
  // ============================================================
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settings = await loadSettings();
        setEndpoint(settings.sheetsEndpoint);
        if (settings.sheetsEndpoint) {
          const data = await fetchTransactionsFromSheets(
            settings.sheetsEndpoint,
          );
          setAllTransactions(data);
        } else {
          // Fallback to local storage if no endpoint configured
          const data = await loadTransactions();
          setAllTransactions(data);
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDelete = async (tx: Transaction) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm(`Yakin ingin menghapus transaksi ${tx.id}?`)
        : await new Promise((resolve) => {
            Alert.alert(
              "Hapus Transaksi",
              `Yakin ingin menghapus transaksi ${tx.id}?`,
              [
                {
                  text: "Batal",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Hapus",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (confirmed) {
      const ok = await deleteTransaction(endpoint, tx.id);
      if (ok) {
        setAllTransactions((prev) =>
          prev.map((t) => (t.id === tx.id ? { ...t, isDeleted: true } : t)),
        );
      } else {
        if (Platform.OS === "web") {
          alert("Gagal menghapus transaksi.");
        } else {
          Alert.alert("Gagal", "Tidak dapat menghapus transaksi.");
        }
      }
    }
  };

  const toDateString = (d: Date | null): string => (d ? toLocalDateKey(d) : "");

  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  const handleDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
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
        const txDate = toLocalDateKey(new Date(tx.timestamp));
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

  const activeFiltered = filtered.filter((tx) => !tx.isDeleted);
  const totalRevenue = activeFiltered.reduce(
    (sum, tx) => sum + tx.grandTotal,
    0,
  );
  const totalOrders = activeFiltered.length;

  // ---- Loading state ----
  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Memuat transaksi...</Text>
      </View>
    );
  }

  // ---- Main render ----
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.scrollContent}
      stickyHeaderIndices={[0]}
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
            <View style={s.dateButton}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={startDate ? C.foreground : C.mutedFg}
                style={{ marginRight: 4 }}
              />
              {Platform.OS === "web" ? (
                <WebDateInput
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Dari"
                />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    setPickerMode("start");
                    setShowPicker(true);
                  }}
                >
                  <Text style={[s.dateButtonText, !startDate && s.placeholder]}>
                    {startDate?.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) ?? "Dari"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={s.dateSeparator}>–</Text>
            <View style={s.dateButton}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={endDate ? C.foreground : C.mutedFg}
                style={{ marginRight: 4 }}
              />
              {Platform.OS === "web" ? (
                <WebDateInput
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Sampai"
                />
              ) : (
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    setPickerMode("end");
                    setShowPicker(true);
                  }}
                >
                  <Text style={[s.dateButtonText, !endDate && s.placeholder]}>
                    {endDate?.toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) ?? "Sampai"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {Platform.OS !== "web" && showPicker && (
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

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={48} color={C.mutedFg} />
          <Text style={s.emptyText}>Tidak ada transaksi.</Text>
        </View>
      ) : (
        filtered.map((tx) => (
          <TransactionCard
            key={tx.id}
            transaction={tx}
            onDelete={handleDelete}
          />
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  stickyHeader: {
    backgroundColor: C.background,
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
  centered: {
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.mutedFg,
  },
});
