import { C, R } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';

export default function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.card}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: C.border, borderRadius: R['2xl'],
    backgroundColor: C.card, padding: 14,
    shadowColor: C.warm, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  label: { fontFamily: 'Poppins_600SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: C.mutedFg },
  value: { fontFamily: 'Poppins_800ExtraBold', fontSize: 22, color: C.primary, marginTop: 2 },
});
