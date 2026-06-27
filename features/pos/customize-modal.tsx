import { formatRp } from "@/lib/pos-store";
import {
  CELUPS,
  FILLINGS,
  SIZES,
  SIZE_LABEL,
  TABURS,
  VARIANTS,
  type CartItem,
  type Celup,
  type Filling,
  type PriceEntry,
  type PriceTier,
  type Size,
  type Tabur,
  type VariantId,
} from "@/lib/pos-types";
import { C, R } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  variantId: VariantId;
  prices: PriceEntry;
  tier: PriceTier;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}

export default function CustomizeModal({
  variantId,
  prices,
  tier,
  onClose,
  onAdd,
}: Props) {
  const variant = VARIANTS.find((v) => v.id === variantId)!;

  const [size, setSize] = useState<Size>("regular");
  const [filling, setFilling] = useState<Filling | undefined>();
  // Default to "celup" when sauce is allowed – forces immediate sub‑choice
  const [sauceMode, setSauceMode] = useState<"celup" | "tabur">("celup");
  const [celup, setCelup] = useState<Celup | undefined>();
  const [tabur, setTabur] = useState<Tabur | undefined>();
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  const unitPrice = prices[size][tier];

  function buildVariantName(): string {
    const parts: string[] = [];

    if (variant.needsFilling && filling) {
      parts.push(filling);
    }
    if (variant.allowsSauce) {
      const sauce = sauceMode === "celup" ? `Celup ${celup}` : `Tabur ${tabur}`;
      if (sauce) {
        parts.push(sauce);
      }
    }

    return parts.length > 0 ? parts.join(" + ") : variant.name;
  }

  function handleAdd() {
    if (variant.needsFilling && !filling) {
      setError("Silakan pilih isian terlebih dahulu");
      return;
    }
    if (variant.allowsSauce) {
      if (sauceMode === "celup" && !celup) {
        setError("Silakan pilih saus celup terlebih dahulu");
        return;
      }
      if (sauceMode === "tabur" && !tabur) {
        setError("Silakan pilih saus tabur terlebih dahulu");
        return;
      }
    }
    onAdd({
      id: Math.random().toString(36).slice(2),
      variantId,
      variantName: buildVariantName(),
      size,
      filling: variant.needsFilling ? filling : undefined,
      celup: variant.allowsSauce && sauceMode === "celup" ? celup : undefined,
      tabur: variant.allowsSauce && sauceMode === "tabur" ? tabur : undefined,
      quantity: qty,
    });
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} onPress={onClose} />
        <View style={[s.sheet]}>
          <View style={s.handle} />
          <ScrollView>
            <Text style={s.title}>{variant.name}</Text>
            <Text style={s.price}>
              <Text style={{ color: C.primary, fontFamily: "Poppins_700Bold" }}>
                {formatRp(unitPrice)}
              </Text>
              {"  "}
              <Text style={s.priceSub}>
                ({SIZE_LABEL[size]} •{" Harga "}
                {tier === "kuantar" ? "Kuantar" : "Normal"})
              </Text>
            </Text>

            <Text style={s.sectionHeader}>
              PILIH UKURAN (WAJIB){" "}
              <Text style={{ color: C.destructive }}>*</Text>
            </Text>
            <View style={s.grid2}>
              {SIZES.map((sz) => (
                <TouchableOpacity
                  key={sz}
                  onPress={() => setSize(sz)}
                  style={[s.chip, size === sz && s.chipActive]}
                >
                  <Text style={[s.chipText, size === sz && s.chipTextActive]}>
                    {SIZE_LABEL[sz]}
                  </Text>
                  <Text style={[s.chipSub, size === sz && s.chipTextActive]}>
                    {formatRp(prices[sz][tier])}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {variant.needsFilling && (
              <>
                <Text style={s.sectionHeader}>
                  PILIH ISIAN (WAJIB){" "}
                  <Text style={{ color: C.destructive }}>*</Text>
                </Text>
                <View style={s.grid3}>
                  {FILLINGS.map((f) => (
                    <TouchableOpacity
                      key={f}
                      onPress={() => {
                        setFilling(f);
                        setError("");
                      }}
                      style={[s.chip, filling === f && s.chipActive]}
                    >
                      <Text
                        style={[s.chipText, filling === f && s.chipTextActive]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {variant.allowsSauce && (
              <>
                <Text style={s.sectionHeader}>
                  PILIH SAUS (WAJIB){" "}
                  <Text style={{ color: C.destructive }}>*</Text>
                </Text>
                {/* Celup/Tabur toggle buttons */}
                <View style={s.sauceModeRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setSauceMode("celup");
                      setCelup(undefined);
                      setError("");
                    }}
                    style={[
                      s.sauceBtn,
                      sauceMode === "celup" && s.sauceBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.sauceBtnText,
                        sauceMode === "celup" && s.sauceBtnTextActive,
                      ]}
                    >
                      Celup
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSauceMode("tabur");
                      setTabur(undefined);
                      setError("");
                    }}
                    style={[
                      s.sauceBtn,
                      sauceMode === "tabur" && s.sauceBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.sauceBtnText,
                        sauceMode === "tabur" && s.sauceBtnTextActive,
                      ]}
                    >
                      Tabur
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Sub‑choices for the active mode */}
                <View style={s.sauceOptionBox}>
                  {sauceMode === "celup" && (
                    <View style={s.grid2}>
                      {CELUPS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          onPress={() => {
                            setCelup(c);
                            setError("");
                          }}
                          style={[s.chip, celup === c && s.chipActive]}
                        >
                          <Text
                            style={[
                              s.chipText,
                              celup === c && s.chipTextActive,
                            ]}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {sauceMode === "tabur" && (
                    <View style={s.grid2}>
                      {TABURS.map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => {
                            setTabur(t);
                            setError("");
                          }}
                          style={[s.chip, tabur === t && s.chipActive]}
                        >
                          <Text
                            style={[
                              s.chipText,
                              tabur === t && s.chipTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            <Text style={s.sectionHeader}>JUMLAH</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Ionicons name="remove" size={18} color={C.foreground} />
              </TouchableOpacity>
              <Text style={s.qtyText}>{qty}</Text>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => setQty((q) => q + 1)}
              >
                <Ionicons name="add" size={18} color={C.foreground} />
              </TouchableOpacity>
            </View>

            {!!error && <Text style={s.error}>{error}</Text>}

            <TouchableOpacity
              style={[s.btnPrimary, { marginTop: 16 }]}
              onPress={handleAdd}
            >
              <Text style={s.btnPrimaryText}>
                Tambah ke Keranjang • {formatRp(unitPrice * qty)}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// styles remain unchanged (only removed unused sauce-related styles if any)
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: "100%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 17,
    color: C.foreground,
    marginBottom: 12,
  },
  price: { fontSize: 14, marginBottom: 4 },
  priceSub: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: C.mutedFg,
  },
  sectionHeader: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: C.mutedFg,
    marginTop: 14,
    marginBottom: 8,
  },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid3: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: R.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: C.background,
    minWidth: "30%",
  },
  chipActive: { borderColor: C.primary, backgroundColor: C.accent },
  chipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.foreground,
  },
  chipTextActive: { color: C.primary },
  chipSub: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: C.primary,
    marginTop: 2,
  },
  sauceModeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  sauceBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  sauceBtnActive: { borderColor: C.primary, backgroundColor: C.primary },
  sauceBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.foreground,
  },
  sauceBtnTextActive: { color: C.primaryFg },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    color: C.foreground,
    width: 40,
    textAlign: "center",
  },
  error: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: C.destructive,
    marginTop: 6,
  },
  btnPrimary: {
    backgroundColor: C.primary,
    borderRadius: R.xl,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  btnPrimaryText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: C.primaryFg,
  },
  sauceOptionBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    padding: 10,
    backgroundColor: C.background,
    marginBottom: 8,
  },
});
