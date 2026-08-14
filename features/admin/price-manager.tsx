import type { CatalogItem } from "@/lib/pos-store";
import {
  fetchCatalog,
  invalidateCatalogCache,
  updateCatalogPrices,
} from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  settings: { sheetsEndpoint?: string };
  onSave: (s: any) => void;
}

export default function PriceManager({ settings, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [editedRows, setEditedRows] = useState<{
    [id: number]: { price_normal: number; price_kuantar: number };
  }>({});

  const loadCatalog = useCallback(
    async (forceRefresh = false) => {
      if (!settings.sheetsEndpoint) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchCatalog(settings.sheetsEndpoint, forceRefresh);
        if (data.length > 0) {
          setCatalog(data);
        } else {
          setFetchError("Katalog kosong atau gagal dimuat dari Google Sheets.");
        }
      } catch {
        setFetchError("Gagal menghubungi Google Sheets.");
      } finally {
        setLoading(false);
      }
    },
    [settings.sheetsEndpoint],
  );

  useEffect(() => {
    loadCatalog(true);
  }, [loadCatalog]);

  const handlePriceChange = (
    id: number,
    field: "price_normal" | "price_kuantar",
    value: string,
  ) => {
    const num = Number(value.replace(/\D/g, "")) || 0;
    setEditedRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: num },
    }));
  };

  const getRowPrice = (row: CatalogItem) => {
    const edits = editedRows[row.id];
    return {
      normal: edits?.price_normal ?? row.price_normal,
      kuantar: edits?.price_kuantar ?? row.price_kuantar,
    };
  };

  const handleSave = async () => {
    if (!settings.sheetsEndpoint) {
      Alert.alert("Error", "No sheets endpoint configured");
      return;
    }

    const updatedRows = catalog.map((row) => {
      const price = getRowPrice(row);
      return {
        ...row,
        price_normal: price.normal,
        price_kuantar: price.kuantar,
      };
    });

    setSyncing(true);
    const success = await updateCatalogPrices(
      settings.sheetsEndpoint,
      updatedRows,
    );
    setSyncing(false);

    if (success) {
      Alert.alert("Berhasil", "Harga diperbarui di Google Sheets");
      // Update local state and invalidate the in-memory catalog cache
      // so the POS screen gets fresh prices on next load.
      invalidateCatalogCache();
      setCatalog(updatedRows);
      setEditedRows({});
      onSave({ ...settings });
    } else {
      Alert.alert("Error", "Gagal menyimpan ke Google Sheets");
    }
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  if (!settings.sheetsEndpoint) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>
          Google Sheets endpoint tidak dikonfigurasi.
        </Text>
        <Text style={s.emptySub}>Atur di Pengaturan terlebih dahulu.</Text>
      </View>
    );
  }

  if (fetchError || catalog.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>Gagal memuat katalog</Text>
        <Text style={s.emptySub}>{fetchError ?? "Katalog kosong."}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => loadCatalog(true)}>
          <Text style={s.retryBtnText}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.outerContainer}>
      <View style={s.contentHeader}>
        <Text style={s.title}>Manajemen Harga</Text>
        <Text style={s.sub}>
          Edit harga di bawah, lalu simpan ke Google Sheets.
        </Text>
      </View>

      <FlatList
        style={s.listStyle}
        contentContainerStyle={s.listContent}
        data={catalog}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const price = getRowPrice(item);

          return (
            <View style={s.row}>
              <Text style={s.rowLabel}>
                {item.variant} {item.size}
                {item.filling ? ` • ${item.filling}` : ""}
                {item.tabur ? ` • ${item.tabur}` : ""}
                {item.celup ? ` • ${item.celup}` : ""}
              </Text>

              <View style={s.priceInputs}>
                <View style={s.priceGroup}>
                  <Text style={s.priceLabel}>Normal</Text>
                  <TextInput
                    style={s.input}
                    value={String(price.normal)}
                    onChangeText={(t) =>
                      handlePriceChange(item.id, "price_normal", t)
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={s.priceGroup}>
                  <Text style={[s.priceLabel, { color: "#9A3412" }]}>
                    Kuantar
                  </Text>
                  <TextInput
                    style={s.input}
                    value={String(price.kuantar)}
                    onChangeText={(t) =>
                      handlePriceChange(item.id, "price_kuantar", t)
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, syncing && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={syncing}
        >
          <Text style={s.saveBtnText}>
            {syncing ? "Menyimpan..." : "Simpan ke Sheets"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outerContainer: {
    flex: 1,
    flexDirection: "column",
  },

  contentHeader: {
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  listStyle: {
    flex: 1,
  },

  listContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
  },

  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 12,
    alignItems: "center",
  },

  saveBtnDisabled: {
    opacity: 0.6,
  },

  saveBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: C.primaryFg,
  },

  // keep all your existing styles below unchanged
  container: { flex: 1, padding: 16 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.mutedFg,
  },
  emptyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: C.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: C.foreground,
  },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    marginBottom: 12,
  },
  row: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 10,
    backgroundColor: C.card,
  },
  rowLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: C.foreground,
    marginBottom: 4,
  },
  priceInputs: {
    flexDirection: "row",
    gap: 12,
  },
  priceGroup: {
    flex: 1,
  },
  priceLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    color: "#065F46",
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: C.foreground,
    backgroundColor: C.background,
  },
});
