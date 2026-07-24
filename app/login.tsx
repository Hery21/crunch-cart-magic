import { loadSettings, loadUser, saveUser } from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const init = async () => {
    try {
      const existingUser = await loadUser();
      if (existingUser) {
        router.replace("/(tabs)");
        return;
      }

      const settings = await loadSettings();
      const url = settings.sheetsEndpoint?.trim();
      if (!url) {
        setLoading(false);
        setError("No Google Sheets endpoint configured.");
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const raw = await (async () => {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        return text;
      })();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `Endpoint returned non‑JSON. First 200 chars: ${raw.substring(0, 200)}`,
        );
      }

      if (data.error) throw new Error(data.error);

      // Normalize user passwords
      const normalized = (Array.isArray(data) ? data : []).map((u: any) => ({
        ...u,
        password: String(u.password ?? ""),
      }));
      setUsers(normalized);
    } catch (err: any) {
      setError(err.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const handleLogin = async () => {
    if (pin.length !== 4) {
      Alert.alert("Error", "PIN must be 4 digits");
      return;
    }

    const foundUser = users.find((u) => u.password === pin);
    if (!foundUser) {
      Alert.alert("Login Failed", "Invalid PIN");
      return;
    }

    await saveUser({
      username: foundUser.username,
      display_name: foundUser.display_name,
      role: foundUser.role,
    });

    router.replace("/(tabs)");
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.container}>
          <Text style={s.title}>Connection Error</Text>
          <Text style={[s.sub, { color: C.destructive }]}>{error}</Text>
          <TouchableOpacity
            style={s.loginBtn}
            onPress={() => {
              setError(null);
              setLoading(true);
              init();
            }}
          >
            <Text style={s.loginBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.container}>
        <Text style={s.title}>Masukkan PIN</Text>
        <Text style={s.sub}>PIN 4 digit</Text>
        <TextInput
          style={s.pinInput}
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
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
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 28,
    color: C.foreground,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: C.mutedFg,
    textAlign: "center",
    marginBottom: 24,
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
  },
  loginBtnText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: C.primaryFg,
  },
});
