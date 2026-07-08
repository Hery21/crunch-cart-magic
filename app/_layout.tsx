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
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

SplashScreen.preventAutoHideAsync();

// Store the intended route during module load
let intendedRoute: string | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/crunch-cart-magic(\/.*)?$/);
  
  if (match) {
    const pathSegment = match[1] || '/';
    const currentHash = window.location.hash;
    
    // If not already using hash routing, store the intended route
    if (!currentHash || currentHash === '#') {
      console.log('📍 Detected subdirectory path:', pathSegment);
      intendedRoute = pathSegment;
    }
  }
}

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  
  const navigationTriggered = useRef(false);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    // After fonts are loaded and app is ready, handle the route
    if (loaded && intendedRoute && !navigationTriggered.current && Platform.OS === 'web') {
      navigationTriggered.current = true;
      console.log('🔀 Navigating to:', intendedRoute);
      
      // Update URL to hash-based routing
      const newUrl = `/crunch-cart-magic/#${intendedRoute}`;
      window.history.replaceState({}, document.title, newUrl);
      
      // Navigate using the router if the route is not root
      if (intendedRoute !== '/' && intendedRoute !== '') {
        router.push(intendedRoute);
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
