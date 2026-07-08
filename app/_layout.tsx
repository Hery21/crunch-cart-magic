// Import web polyfills first, before anything else
import '../web-polyfill';

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
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

// Handle GitHub Pages subdirectory routing on web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/crunch-cart-magic(\/.*)?$/);
  
  if (match) {
    const pathSegment = match[1] || '/';
    const currentHash = window.location.hash;
    
    // If not already using hash routing, convert to it
    if (!currentHash || currentHash === '#') {
      console.log('🔄 Converting to hash-based routing:', pathSegment);
      const newUrl = `/crunch-cart-magic/#${pathSegment}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
