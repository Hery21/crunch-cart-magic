import { DEFAULT_SETTINGS, VARIANTS, type PriceTier, type Size, type VariantId } from '@/lib/pos-types';
import { C, R } from '@/lib/theme';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  settings: typeof DEFAULT_SETTINGS;
  onSave: (s: typeof DEFAULT_SETTINGS) => void;
}

export default function PriceManager({ settings, onSave }: Props) {
  const [prices, setPrices] = useState(
    () => JSON.parse(JSON.stringify(settings.prices)) as typeof settings.prices,
  );

  function setPrice(variantId: VariantId, size: Size, tier: PriceTier, value: number) {
    setPrices((p) => ({
      ...p,
      [variantId]: { ...p[variantId], [size]: { ...p[variantId][size], [tier]: value } },
    }));
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Manajemen Harga (16 harga)</Text>
        <Text style={s.cardDesc}>
          Tarif <Text style={{ fontFamily: 'Poppins_700Bold' }}>Normal</Text>{' '}
          berlaku untuk Cash & QRIS. Tarif{' '}
          <Text style={{ fontFamily: 'Poppins_700Bold' }}>Kuantar</Text> berlaku
          otomatis saat metode bayar Kuantar dipilih.
        </Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          {VARIANTS.map((v) => (
            <View key={v.id} style={s.variantBox}>
              <Text style={s.variantName}>{v.name}</Text>
              {(['regular', 'jumbo'] as Size[]).map((sz) => (
                <View key={sz} style={s.sizeBox}>
                  <Text style={s.sizeLabel}>{sz === 'jumbo' ? 'Jumbo' : 'Regular'}</Text>
                  <View style={s.priceGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.priceTierLabel}>Normal (Cash/QRIS)</Text>
                      <TextInput
                        style={s.priceInput}
                        value={String(prices[v.id]?.[sz]?.normal ?? 0)}
                        onChangeText={(t) => setPrice(v.id, sz, 'normal', Number(t.replace(/\D/g, '')) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.priceTierLabel, { color: '#9A3412' }]}>Kuantar</Text>
                      <TextInput
                        style={s.priceInput}
                        value={String(prices[v.id]?.[sz]?.kuantar ?? 0)}
                        onChangeText={(t) => setPrice(v.id, sz, 'kuantar', Number(t.replace(/\D/g, '')) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={s.actionRow}>
        <TouchableOpacity style={s.btnPrimary} onPress={() => onSave({ ...settings, prices })}>
          <Text style={s.btnPrimaryText}>Simpan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => setPrices(JSON.parse(JSON.stringify(DEFAULT_SETTINGS.prices)))}
        >
          <Text style={s.btnOutlineText}>Reset Default</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.border, borderRadius: R['2xl'], backgroundColor: C.card, padding: 14 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.foreground, marginBottom: 4 },
  cardDesc: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.mutedFg, marginBottom: 4 },
  variantBox: { borderWidth: 1, borderColor: C.border + '70', borderRadius: R.xl, padding: 10, gap: 8 },
  variantName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.foreground },
  sizeBox: { borderWidth: 1, borderColor: C.border + '50', borderRadius: R.lg, backgroundColor: C.muted + '50', padding: 10, gap: 6 },
  sizeLabel: { fontFamily: 'Poppins_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: C.amberText },
  priceGrid: { flexDirection: 'row', gap: 8 },
  priceTierLabel: { fontFamily: 'Poppins_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: '#065F46', marginBottom: 4 },
  priceInput: { borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 6, paddingHorizontal: 10, fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.foreground, backgroundColor: C.card },
  actionRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: { flex: 1, backgroundColor: C.primary, borderRadius: R.xl, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.primaryFg },
  btnOutline: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: R.xl, paddingVertical: 12, alignItems: 'center' },
  btnOutlineText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.foreground },
});
