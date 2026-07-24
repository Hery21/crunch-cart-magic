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

/**
 * Fetches JSON from a Google Apps Script /exec endpoint in a way that works
 * on iOS Safari.
 *
 * WHY THIS IS NEEDED:
 * - Apps Script /exec always 302-redirects to script.googleusercontent.com.
 * - Safari blocks third-party cookies, so on a cross-site fetch it follows
 *   that redirect WITHOUT Google's consent cookie. Google then returns a
 *   security/consent HTML page (window['ppConfig'] / csp.withgoogle.com)
 *   instead of your JSON, and JSON.parse() throws "non-JSON data".
 * - Chrome works because it sends the third-party cookie.
 *
 * STRATEGY:
 *   1. Try the endpoint directly (fast path; works on Chrome/Android/etc.).
 *   2. If we detect an HTML/interstitial response (Safari case), transparently
 *      retry through a CORS proxy, which follows Google's redirect server-side
 *      and returns clean JSON with proper CORS headers.
 */

// A CORS proxy that follows redirects server-side and echoes proper CORS
// headers. Swap this for your own tiny Cloudflare Worker / proxy in production
// for reliability & privacy.
const CORS_PROXY = "https://corsproxy.io/?url=";

// Detects Google's interstitial / any HTML page (i.e. NOT your JSON array).
function looksLikeHtml(text: string): boolean {
  const t = text.trim().slice(0, 300).toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("ppconfig") ||
    t.includes("csp.withgoogle.com") ||
    t.includes("accounts.google.com") ||
    t.includes("sign in")
  );
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchUsersJson(endpoint: string): Promise<any> {
  // Cache-buster so Safari never serves a stale bad response.
  const bust = (endpoint.includes("?") ? "&" : "?") + "t=" + Date.now();
  const directUrl = endpoint + bust;

  // 1) Fast path: direct request.
  let raw = await fetchText(directUrl, 30000);

  // 2) Safari fallback: got HTML instead of JSON -> retry via proxy.
  if (looksLikeHtml(raw)) {
    const proxied = CORS_PROXY + encodeURIComponent(directUrl);
    raw = await fetchText(proxied, 30000);
  }

  // Still HTML? Then it's a real deployment/permission problem, not Safari.
  if (looksLikeHtml(raw)) {
    throw new Error(
      "The endpoint returned a Google web page instead of JSON. " +
        "Check that the Apps Script is deployed with access set to " +
        '"Anyone" and redeploy a new version.',
    );
  }

  // Strip UTF-8 BOM / stray whitespace, then parse.
  const cleaned = raw.trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Endpoint returned non-JSON data. First 200 chars: ${cleaned.substring(
        0,
        200,
      )}`,
    );
  }
}

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

      const data = await fetchUsersJson(url);

      if (data && data.error) throw new Error(data.error);

      // Normalize user passwords
      const normalized = (Array.isArray(data) ? data : []).map((u: any) => ({
        ...u,
        password: String(u.password ?? ""),
      }));
      setUsers(normalized);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request timed out. Please check your connection and retry.");
      } else {
        setError(err.message || "Failed to load users.");
      }
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
