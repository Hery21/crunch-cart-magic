import { loadSettings, saveSettings } from '@/lib/pos-store';
import { DEFAULT_SETTINGS } from '@/lib/pos-types';
import { C, R } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PriceManager from './price-manager';
import SettingsPanel from './settings-panel';
import TransactionTab from './transaction-tab';

type Tab = 'tx' | 'prices' | 'settings';

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('tx');
  const [settings, setSettings] = useState(() => DEFAULT_SETTINGS);

  useEffect(() => { loadSettings().then(setSettings); }, []);

  function handleSave(s: typeof DEFAULT_SETTINGS, msg: string) {
    saveSettings(s);
    setSettings(s);
    Alert.alert('Berhasil', msg);
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={C.foreground} />
          </TouchableOpacity>
          <Text style={s.title}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={16} color={C.foreground} />
          <Text style={s.logoutBtnText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabBar}>
        {([['tx', 'Transaksi'], ['prices', 'Harga'], ['settings', 'Pengaturan']] as const).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[s.tabBtn, tab === k && s.tabBtnActive]}>
            <Text style={[s.tabBtnText, tab === k && s.tabBtnTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {tab === 'tx' && <TransactionTab />}
        {tab === 'prices' && (
          <PriceManager settings={settings} onSave={(s) => handleSave(s, 'Harga disimpan')} />
        )}
        {tab === 'settings' && (
          <SettingsPanel settings={settings} onSave={(s) => handleSave(s, 'Pengaturan disimpan')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 6, borderRadius: R.lg, backgroundColor: C.muted },
  title: { fontFamily: 'Poppins_800ExtraBold', fontSize: 18, color: C.foreground },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: R.lg, paddingHorizontal: 10, paddingVertical: 6 },
  logoutBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 12, color: C.foreground },
  tabBar: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  tabBtn: { borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 7 },
  tabBtnActive: { backgroundColor: C.primary },
  tabBtnText: { fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: C.mutedFg },
  tabBtnTextActive: { color: C.primaryFg },
});
