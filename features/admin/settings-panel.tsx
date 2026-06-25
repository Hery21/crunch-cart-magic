import { DEFAULT_SETTINGS } from '@/lib/pos-types';
import { C, R } from '@/lib/theme';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';

interface Props {
  settings: typeof DEFAULT_SETTINGS;
  onSave: (s: typeof DEFAULT_SETTINGS) => void;
}

export default function SettingsPanel({ settings, onSave }: Props) {
  const [pin, setPin] = useState(settings.pin);
  const [endpoint, setEndpoint] = useState(settings.sheetsEndpoint);

  return (
    <View style={{ gap: 12 }}>
      <View style={s.card}>
        <Text style={s.cardTitle}>Ubah PIN Admin</Text>
        <TextInput
          style={s.textInput}
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 digit"
          placeholderTextColor={C.mutedFg}
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
        />
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Google Sheets Endpoint</Text>
        <Text style={s.cardDesc}>
          URL Web App Apps Script untuk menerima data transaksi. Kosongkan untuk hanya menyimpan lokal.
        </Text>
        <TextInput
          style={s.textInput}
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="https://script.google.com/macros/s/.../exec"
          placeholderTextColor={C.mutedFg}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <TouchableOpacity
        style={s.btnPrimary}
        onPress={() => {
          if (pin.length !== 4) { Alert.alert('Error', 'PIN harus 4 digit'); return; }
          onSave({ ...settings, pin, sheetsEndpoint: endpoint });
        }}
      >
        <Text style={s.btnPrimaryText}>Simpan</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.border, borderRadius: R['2xl'], backgroundColor: C.card, padding: 14 },
  cardTitle: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: C.foreground, marginBottom: 4 },
  cardDesc: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: C.mutedFg, marginBottom: 4 },
  textInput: { borderWidth: 1, borderColor: C.border, borderRadius: R.xl, paddingVertical: 10, paddingHorizontal: 14, fontFamily: 'Poppins_400Regular', fontSize: 13, color: C.foreground, backgroundColor: C.background, marginTop: 8 },
  btnPrimary: { backgroundColor: C.primary, borderRadius: R.xl, paddingVertical: 13, alignItems: 'center' },
  btnPrimaryText: { fontFamily: 'Poppins_700Bold', fontSize: 14, color: C.primaryFg },
});
