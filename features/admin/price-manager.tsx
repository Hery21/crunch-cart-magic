import { fetchCatalog, invalidateCatalogCache, updateCatalogPrices } from "@/lib/pos-store";
import type { CatalogItem } from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { useEffect, useState } from "react";
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
  const [syncing, setSyncing] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [editedRows, setEditedRows] = useState<{ [id: number]: { price_normal: number; price_kuantar: number } }>({});

  useEffect(() => {
    const load = async () => {
      if (!settings.sheetsEndpoint) {
        setLoading(false);
        return;
      }
      try {
        const data = await fetchCatalog(settings.sheetsEndpoint, true);
        setCatalog(data);
      } catch {
        Alert.alert("Error", "Failed to load catalog");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [settings.sheetsEndpoint]);

  const handlePriceChange = (id: number, field: 'price_normal' | 'price_kuantar', value: string) => {
    const num = Number(value.replace(/\D/g, '')) || 0;
    setEditedRows(prev => ({
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

    const updatedRows = catalog.map(row => {
      const edits = editedRows[row.id];
      if (edits) {
        return { ...row, price_normal: edits.price_normal, price_kuantar: edits.price_kuantar };
      }
      return row;
    });

    setSyncing(true);
    const success = await updateCatalogPrices(settings.sheetsEndpoint, updatedRows);
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
        <Text style={s.emptyText}>Google Sheets endpoint tidak dikonfigurasi.</Text>
        <Text style={s.emptySub}>Atur di Pengaturan terlebih dahulu.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Manajemen Harga</Text>
      <Text style={s.sub}>Edit harga di bawah, lalu simpan ke Google Sheets.</Text>
      <FlatList
        data={catalog}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => {
          const price = getRowPrice(item);
          return (
            <View style={s.row}>
              <Text style={s.rowLabel}>
                {item.variant} {item.size}
                {item.filling ? ` • ${item.filling}` : ''}
                {item.tabur ? ` • ${item.tabur}` : ''}
                {item.celup ? ` • ${item.celup}` : ''}
              </Text>
              <View style={s.priceInputs}>
                <View style={s.priceGroup}>
                  <Text style={s.priceLabel}>Normal</Text>
                  <TextInput
                    style={s.input}
                    value={String(price.normal)}
                    onChangeText={(t) => handlePriceChange(item.id, 'price_normal', t)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={s.priceGroup}>
                  <Text style={[s.priceLabel, { color: '#9A3412' }]}>Kuantar</Text>
                  <TextInput
                    style={s.input}
                    value={String(price.kuantar)}
                    onChangeText={(t) => handlePriceChange(item.id, 'price_kuantar', t)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          );
        }}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={syncing}>
        <Text style={s.saveBtnText}>{syncing ? "Menyimpan..." : "Simpan ke Sheets"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: C.mutedFg },
  emptyText: { fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: C.foreground, textAlign: 'center' },
  emptySub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.mutedFg, textAlign: 'center' },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 18, color: C.foreground },
  sub: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.mutedFg, marginBottom: 12 },
  listContent: { gap: 8, paddingBottom: 12 },
  row: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: 10,
    backgroundColor: C.card,
  },
  rowLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: C.foreground,
    marginBottom: 4,
  },
  priceInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  priceGroup: {
    flex: 1,
  },
  priceLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#065F46',
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: C.foreground,
    backgroundColor: C.background,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: C.primaryFg,
  },
});