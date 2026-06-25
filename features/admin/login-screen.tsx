import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Props {
  pin: string;
  onChangePin: (pin: string) => void;
  onLogin: () => boolean;
}

export default function LoginScreen({ pin, onChangePin, onLogin }: Props) {
  function handleLogin() {
    if (!onLogin()) Alert.alert("Login Gagal", "PIN salah");
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={C.mutedFg} />
          <Text style={s.backBtnText}>Kembali</Text>
        </TouchableOpacity>
        <Text style={s.title}>Admin Login</Text>
        <Text style={s.sub}>Masukkan PIN 4 digit</Text>
        <TextInput
          style={s.pinInput}
          value={pin}
          onChangeText={(t) => onChangePin(t.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          keyboardType="numeric"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={handleLogin}
        />
        <TouchableOpacity style={s.loginBtn} onPress={handleLogin}>
          <Text style={s.loginBtnText}>Masuk</Text>
        </TouchableOpacity>
        <Text style={s.hint}>PIN default: 1234</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  backBtnText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
  },
  title: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 28,
    color: C.foreground,
    alignSelf: "flex-start",
  },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  pinInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingVertical: 14,
    paddingHorizontal: 16,
    textAlign: "center",
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    letterSpacing: 12,
    color: C.foreground,
    backgroundColor: C.card,
    marginBottom: 12,
  },
  loginBtn: {
    width: "100%",
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  loginBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: C.primaryFg,
  },
  hint: { fontFamily: "Poppins_400Regular", fontSize: 12, color: C.mutedFg },
});
