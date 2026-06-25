import { formatRp } from '@/lib/pos-store';
import { SIZE_LABEL, type PriceTier } from '@/lib/pos-types';
import { C, R } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PricedCartItem } from './use-pos';

interface Props {
  visible: boolean;
  cart: PricedCartItem[];
  subtotal: number;
  tier: PriceTier;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onClose: () => void;
}

export default function CartSheet({ visible, cart, subtotal, tier, onUpdateQty, onRemove, onCheckout, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Keranjang</Text>
          <ScrollView style={{ maxHeight: '70%' }}>
            {cart.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>Belum ada item.</Text></View>
            ) : (
              <View>
                {cart.map((item) => (
                  <View key={item.id} style={s.item}>
                    <View style={s.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={s.badges}>
                          <Text style={s.itemName} numberOfLines={1}>{item.variantName}</Text>
                          <View style={s.badgeAmber}><Text style={s.badgeAmberText}>{SIZE_LABEL[item.size].toUpperCase()}</Text></View>
                          <View style={item.priceTier === 'kuantar' ? s.badgeOrange : s.badgeEmerald}>
                            <Text style={item.priceTier === 'kuantar' ? s.badgeOrangeText : s.badgeEmeraldText}>
                              {item.priceTier === 'kuantar' ? 'KUANTAR' : 'NORMAL'}
                            </Text>
                          </View>
                        </View>
                        <Text style={s.addons}>
                          {[item.filling && `Isi: ${item.filling}`, item.celup && `Celup: ${item.celup}`, item.tabur && `Tabur: ${item.tabur}`]
                            .filter(Boolean).join(' • ') || 'Tanpa tambahan'}
                        </Text>
                        <Text style={s.unitPrice}>{formatRp(item.unitPrice)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color={C.mutedFg} />
                      </TouchableOpacity>
                    </View>
                    <View style={s.itemFooter}>
                      <View style={s.qtyRow}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(item.id, -1)}>
                          <Ionicons name="remove" size={14} color={C.foreground} />
                        </TouchableOpacity>
                        <Text style={s.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(item.id, 1)}>
                          <Ionicons name="add" size={14} color={C.foreground} />
                        </TouchableOpacity>
                      </View>
                      <Text style={s.itemTotal}>{formatRp(item.unitPrice * item.quantity)}</Text>
                    </View>
                  </View>
                ))}
                <View style={s.summary}>
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Total ({tier === 'kuantar' ? 'Kuantar' : 'Normal'})</Text>
                    <Text style={s.summaryTotal}>{formatRp(subtotal)}</Text>
                  </View>
                  <TouchableOpacity style={s.btnPrimary} onPress={onCheckout} disabled={cart.length === 0}>
                    <Text style={s.btnPrimaryText}>Bayar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: 'Poppins_700Bold', fontSize: 17, color: C.foreground, marginBottom: 12 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.mutedFg },
  item: { borderWidth: 1, borderColor: C.border, borderRadius: R.xl, backgroundColor: C.background, padding: 12, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginBottom: 2 },
  itemName: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.foreground },
  addons: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.mutedFg },
  unitPrice: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.foreground, marginTop: 2 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  itemTotal: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: C.primary },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 34, height: 34, borderRadius: R.full, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontFamily: 'Poppins_700Bold', fontSize: 13, color: C.foreground, width: 24, textAlign: 'center' },
  summary: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, gap: 10, marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.mutedFg },
  summaryTotal: { fontFamily: 'Poppins_800ExtraBold', fontSize: 18, color: C.primary },
  badgeAmber: { backgroundColor: C.amber, borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 },
  badgeAmberText: { fontFamily: 'Poppins_700Bold', fontSize: 9, color: C.amberText },
  badgeOrange: { backgroundColor: C.orange, borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 },
  badgeOrangeText: { fontFamily: 'Poppins_700Bold', fontSize: 9, color: C.orangeText },
  badgeEmerald: { backgroundColor: C.emerald, borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 },
  badgeEmeraldText: { fontFamily: 'Poppins_700Bold', fontSize: 9, color: C.emeraldText },
  btnPrimary: { backgroundColor: C.primary, borderRadius: R.xl, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  btnPrimaryText: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.primaryFg },
});
