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
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
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

  useEffect(() => {
    // On web, handle subdirectory routing for GitHub Pages
    if (Platform.OS === 'web' && loaded && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const search = window.location.search;
      
      // Match pattern: /crunch-cart-magic/... or /crunch-cart-magic
      const match = pathname.match(/^\/crunch-cart-magic(\/.*)?$/);
      
      if (match) {
        const routePath = match[1] || '/';
        
        // Navigate to the correct route
        if (routePath !== window.location.hash.slice(1) && !window.location.hash) {
          console.log('📍 Detected subdirectory, routing to:', routePath);
          router.replace(routePath);
        }
      }
    }
  }, [loaded, router]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
