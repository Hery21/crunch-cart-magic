import { loadUser } from "@/lib/pos-store";
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const loggedUser = await loadUser();
      setUser(loggedUser);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // User is authenticated – render the tab navigator (or just a Stack)
  // Since you already have a Stack in root, you can render a Stack here
  // or keep it simple and just render the screens directly.
  // In your project, (tabs) likely contains index.tsx, settings.tsx, etc.
  return <Stack screenOptions={{ headerShown: false }} />;
}