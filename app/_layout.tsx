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

// Custom linking configuration for GitHub Pages subdirectory
const linking = {
  prefixes: [
    'https://hery21.github.io/crunch-cart-magic',
    'https://hery21.github.io/crunch-cart-magic/',
    'crunch-cart-magic://',
    '',
  ],
  config: {
    screens: {
      index: '',
      admin: 'admin',
      report: 'report',
    },
  },
  // Custom parse function to handle subdirectory
  async getInitialURL() {
    if (typeof window === 'undefined') return null;

    const pathname = window.location.pathname;
    const match = pathname.match(/^\/crunch-cart-magic(\/[^?]*)?/);
    
    if (match) {
      const path = match[1] || '/';
      console.log('📍 getInitialURL: path =', path);
      return path === '/' ? '/' : path;
    }
    
    return '/';
  },
  subscribe(listener: (url: string) => void) {
    if (typeof window === 'undefined') return () => {};

    const handleLocationChange = () => {
      const pathname = window.location.pathname;
      const match = pathname.match(/^\/crunch-cart-magic(\/[^?]*)?/);
      
      if (match) {
        const path = match[1] || '/';
        console.log('📍 subscribe: path =', path);
        listener(path === '/' ? '/' : path);
      }
    };

    // Listen to popstate events
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  },
};

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
      <Stack
        screenOptions={{ headerShown: false }}
        linking={Platform.OS === 'web' ? linking : undefined}
      />
    </>
  );
}
