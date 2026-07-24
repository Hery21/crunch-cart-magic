// web-polyfill must be imported FIRST
import "../web-polyfill";

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// ------------------------------------------------------------------
// Web subdirectory detection (kept from your original logic)
// ------------------------------------------------------------------
let intendedRoute: string | null = null;

if (Platform.OS === "web" && typeof window !== "undefined") {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/crunch-cart-magic(\/.*)?$/);
  if (match) {
    const pathSegment = match[1] || "/";
    const currentHash = window.location.hash;
    if (!currentHash || currentHash === "#") {
      console.log("📍 Detected subdirectory path:", pathSegment);
      intendedRoute = pathSegment;
    }
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle subdirectory redirect on web (only once, after fonts load)
  useEffect(() => {
    if (
      fontsLoaded &&
      intendedRoute &&
      Platform.OS === "web" &&
      intendedRoute !== "/" &&
      intendedRoute !== ""
    ) {
      // Update URL to use hash-based routing
      const newUrl = `/crunch-cart-magic/#${intendedRoute}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
