import type { PaymentMethod } from "@/lib/pos-types";
import { clearUser, loadUser } from "@/lib/pos-store";
import { C, R } from "@/lib/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PAYMENT_METHODS = [
  { id: "Cash" as const, icon: "wallet-outline", label: "Cash" },
  { id: "QRIS" as const, icon: "qr-code-outline", label: "QRIS" },
  { id: "Kuantar" as const, iconSet: "mci", icon: "bike", label: "Kuantar" },
];

interface Props {
  clock: string;
  paymentMethod: PaymentMethod;
  onChangePayment: (pm: PaymentMethod) => void;
}

export default function PosHeader({
  clock,
  paymentMethod,
  onChangePayment,
}: Props) {
  // Store the full user object instead of just the role
  const [user, setUser] = useState<{ display_name: string; role: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const loggedUser = await loadUser();
      setUser(loggedUser);
    };
    getUser();
  }, []);

  const handleLogout = () => {
    const logoutAction = async () => {
      await clearUser();
      router.replace("/login");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) {
        logoutAction();
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: logoutAction,
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <LinearGradient
      colors={[C.warm, C.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    >
      <View style={s.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            🍗 CHICKEN CRUNCHY ROLL
          </Text>
          {/* 👇 Show display_name or fallback to "Kasir" */}
          <Text style={s.headerSub}>
            {user?.display_name || "Kasir"} • {clock}
          </Text>
        </View>
        <TouchableOpacity
          style={s.headerAction}
          onPress={() => router.push("/report")}
        >
          <Ionicons name="document-text-outline" size={16} color={C.warmFg} />
          <Text style={s.headerActionText}>Laporan</Text>
        </TouchableOpacity>

        {/* 👇 Check role from the user object */}
        {user?.role === "admin" && (
          <TouchableOpacity
            style={s.headerAction}
            onPress={() => router.push("/admin")}
          >
            <Text style={s.headerActionText}>Admin</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.headerAction} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={C.warmFg} />
          <Text style={s.headerActionText}>Logout</Text>
        </TouchableOpacity>
      </View>
      <View style={s.payBar}>
        <Text style={s.payBarLabel}>Harga:</Text>
        {PAYMENT_METHODS.map((pm) => {
          const active = paymentMethod === pm.id;
          return (
            <TouchableOpacity
              key={pm.id}
              onPress={() => onChangePayment(pm.id)}
              style={[s.payPill, active && s.payPillActive]}
            >
              {pm.iconSet === "mci" ? (
                <MaterialCommunityIcons
                  name={pm.icon as "bike"}
                  size={14}
                  color={active ? C.primary : "#fff"}
                />
              ) : (
                <Ionicons
                  name={pm.icon as "wallet-outline"}
                  size={14}
                  color={active ? C.primary : "#fff"}
                />
              )}
              <Text style={[s.payPillText, active && s.payPillTextActive]}>
                {pm.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 18,
    color: C.warmFg,
  },
  headerSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.warmFg,
    opacity: 0.9,
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  headerActionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.warmFg,
  },
  payBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  payBarLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    color: C.warmFg,
    opacity: 0.8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  payPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payPillActive: { backgroundColor: "#fff" },
  payPillText: { fontFamily: "Poppins_700Bold", fontSize: 12, color: "#fff" },
  payPillTextActive: { color: C.primary },
});