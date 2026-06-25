import { formatRp } from "@/lib/pos-store";
import {
  SIZES,
  SIZE_LABEL,
  VARIANTS,
  type PriceTier,
  type VariantId,
} from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  tier: PriceTier;
  priceFor: (variantId: VariantId, size: (typeof SIZES)[number]) => number;
  onSelect: (id: VariantId) => void;
}

export default function MenuGrid({ tier, priceFor, onSelect }: Props) {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      <Text style={s.sectionLabel}>
        Menu • Tarif {tier === "kuantar" ? "Kuantar" : "Normal"}
      </Text>
      <View style={s.menuGrid}>
        {VARIANTS.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={s.menuCard}
            onPress={() => onSelect(v.id)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[C.sunny, C.accent, C.primary + "50"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.menuCardImage}
            >
              <Text style={s.menuCardEmoji}>🌯</Text>
            </LinearGradient>
            <View style={s.menuCardBody}>
              <Text style={s.menuCardName}>{v.name}</Text>
              <Text style={s.menuCardDesc}>{v.description}</Text>
              <View style={s.menuCardPrices}>
                {SIZES.map((sz) => (
                  <View key={sz} style={s.menuCardPriceRow}>
                    <Text style={s.menuCardSizeLabel}>{SIZE_LABEL[sz]}</Text>
                    <Text style={s.menuCardPrice}>
                      {formatRp(priceFor(v.id, sz))}
                    </Text>
                  </View>
                ))}
                <Text style={s.menuCardTier}>
                  Tarif {tier === "kuantar" ? "Kuantar" : "Normal"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.mutedFg,
    marginBottom: 12,
  },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  menuCard: {
    width: "47.5%",
    borderRadius: R["2xl"],
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    overflow: "hidden",
    shadowColor: C.warm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  menuCardImage: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  menuCardEmoji: { fontSize: 44 },
  menuCardBody: { padding: 12, gap: 6 },
  menuCardName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    color: C.foreground,
  },
  menuCardDesc: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: C.mutedFg,
  },
  menuCardPrices: { gap: 2 },
  menuCardPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  menuCardSizeLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.mutedFg,
  },
  menuCardPrice: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 14,
    color: C.primary,
  },
  menuCardTier: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: C.mutedFg,
    marginTop: 2,
  },
});
