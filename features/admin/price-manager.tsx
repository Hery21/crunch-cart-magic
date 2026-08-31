import type { CatalogItem } from "@/lib/pos-store";
import {
  fetchCatalog,
  invalidateCatalogCache,
  updateCatalogPrices,
} from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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

// Human-readable labels for each variant classification
const VARIANT_LABELS: Record<string, string> = {
  original: "Original",
  filling: "Isi (Filling)",
  tabur: "Tabur",
  celup: "Celup",
  filling_tabur: "Isi + Tabur",
  filling_celup: "Isi + Celup",
};
const VARIANT_ORDER = Object.keys(VARIANT_LABELS);

/** One row per (variant, size) classification; price applies to every catalog row it covers. */
interface PriceGroup {
  key: string;
  variant: string;
  size: string;
  label: string;
  ids: number[];
  price_normal: number;
  price_kuantar: number;
}

// Picks the most common value so a stray mismatched row doesn't skew the group's shown price.
function modeValue(values: number[]): number {
  const counts = new Map<number, number>();
  let best = values[0];
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}

function buildGroups(catalog: CatalogItem[]): PriceGroup[] {
  const byKey = new Map<string, CatalogItem[]>();
  catalog.forEach((item) => {
    const key = `${item.variant}__${item.size}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(item);
  });

  const groups: PriceGroup[] = Array.from(byKey.entries()).map(
    ([key, items]) => ({
      key,
      variant: items[0].variant,
      size: items[0].size,
      label: `${VARIANT_LABELS[items[0].variant] ?? items[0].variant} • ${
        items[0].size === "jumbo" ? "Jumbo" : "Regular"
      }`,
      ids: items.map((i) => i.id),
      price_normal: modeValue(items.map((i) => i.price_normal)),
      price_kuantar: modeValue(items.map((i) => i.price_kuantar)),
    }),
  );

  groups.sort((a, b) => {
    const va = VARIANT_ORDER.indexOf(a.variant);
    const vb = VARIANT_ORDER.indexOf(b.variant);
    if (va !== vb) return va - vb;
    return a.size === b.size ? 0 : a.size === "regular" ? -1 : 1;
  });

  return groups;
}

// Web-compatible alert that works in browser
const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function PriceManager({ settings, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [editedGroups, setEditedGroups] = useState<{
    [key: string]: { price_normal: number; price_kuantar: number };
  }>({});

  const groups = useMemo(() => buildGroups(catalog), [catalog]);

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
    groupKey: string,
    field: "price_normal" | "price_kuantar",
    value: string,
  ) => {
    const num = Number(value.replace(/\D/g, "")) || 0;
    setEditedGroups((prev) => ({
      ...prev,
      [groupKey]: { ...prev[groupKey], [field]: num },
    }));
  };

  const getGroupPrice = (group: PriceGroup) => {
    const edits = editedGroups[group.key];
    return {
      normal: edits?.price_normal ?? group.price_normal,
      kuantar: edits?.price_kuantar ?? group.price_kuantar,
    };
  };

  const handleSave = async () => {
    if (!settings.sheetsEndpoint) {
      showAlert("Error", "No sheets endpoint configured");
      return;
    }

    const priceByGroupKey = new Map(
      groups.map((group) => [group.key, getGroupPrice(group)]),
    );
    const updatedRows = catalog.map((row) => {
      const price = priceByGroupKey.get(`${row.variant}__${row.size}`)!;
      return {
        ...row,
        price_normal: price.normal,
        price_kuantar: price.kuantar,
      };
    });

    setSyncing(true);
    try {
      const success = await updateCatalogPrices(
        settings.sheetsEndpoint,
        updatedRows,
      );
      setSyncing(false);

      if (success) {
        // Update local state and invalidate the in-memory catalog cache
        // so the POS screen gets fresh prices on next load.
        invalidateCatalogCache();
        setCatalog(updatedRows);
        setEditedGroups({});
        onSave({ ...settings });
        showAlert("Berhasil", "Harga diperbarui di Google Sheets");
      } else {
        showAlert("Error", "Gagal menyimpan ke Google Sheets");
      }
    } catch (error) {
      setSyncing(false);
      console.error("handleSave error:", error);
      showAlert(
        "Error",
        `Gagal menyimpan: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

  if (fetchError || groups.length === 0) {
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
          Edit harga per klasifikasi di bawah, lalu simpan ke Google Sheets.
        </Text>
      </View>

      <FlatList
        style={s.listStyle}
        contentContainerStyle={s.listContent}
        data={groups}
        keyExtractor={(group) => group.key}
        renderItem={({ item: group }) => {
          const price = getGroupPrice(group);

          return (
            <View style={s.row}>
              <Text style={s.rowLabel}>{group.label}</Text>
              <Text style={s.rowCount}>{group.ids.length} varian</Text>

              <View style={s.priceInputs}>
                <View style={s.priceGroup}>
                  <Text style={s.priceLabel}>Normal</Text>
                  <TextInput
                    style={s.input}
                    value={String(price.normal)}
                    onChangeText={(t) =>
                      handlePriceChange(group.key, "price_normal", t)
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
                      handlePriceChange(group.key, "price_kuantar", t)
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
            <ActivityIndicator size="large" color={C.primary} />
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
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
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
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: C.foreground,
    marginBottom: 2,
  },
  rowCount: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.mutedFg,
    marginBottom: 6,
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
