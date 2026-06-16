export type VariantId = "original" | "filling" | "tabur_celup" | "filling_tabur_celup";
export type PriceTier = "normal" | "kuantar";

export type Filling = "Mentai" | "Garlic" | "Cheese";
export type Celup = "Barbeque Spicy" | "Sadis" | "Teriyaki" | "Lada Hitam";
export type Tabur = "Bubuk Keju" | "Bubuk Balado" | "Bubuk Sweet Corn";

export const FILLINGS: Filling[] = ["Mentai", "Garlic", "Cheese"];
export const CELUPS: Celup[] = ["Barbeque Spicy", "Sadis", "Teriyaki", "Lada Hitam"];
export const TABURS: Tabur[] = ["Bubuk Keju", "Bubuk Balado", "Bubuk Sweet Corn"];

export interface ProductVariant {
  id: VariantId;
  name: string;
  description: string;
  needsFilling: boolean;
  allowsSauce: boolean;
}

export const VARIANTS: ProductVariant[] = [
  { id: "original", name: "CCR Original", description: "Tanpa isian, tanpa saus", needsFilling: false, allowsSauce: false },
  { id: "filling", name: "CCR Filling", description: "Pilih 1 isian", needsFilling: true, allowsSauce: false },
  { id: "tabur_celup", name: "CCR Tabur / Celup", description: "Pilih 1 saus celup atau bubuk tabur", needsFilling: false, allowsSauce: true },
  { id: "filling_tabur_celup", name: "CCR Filling + Tabur / Celup", description: "Pilih 1 isian + 1 saus", needsFilling: true, allowsSauce: true },
];

export interface PriceEntry {
  normal: number;
  kuantar: number;
}

export type PriceMap = Record<VariantId, PriceEntry>;

export interface Settings {
  prices: PriceMap;
  pin: string;
  sheetsEndpoint: string;
  invoiceCounter: number;
}

export const DEFAULT_PRICES: PriceMap = {
  original: { normal: 10000, kuantar: 12000 },
  filling: { normal: 12000, kuantar: 14500 },
  tabur_celup: { normal: 15000, kuantar: 17500 },
  filling_tabur_celup: { normal: 18000, kuantar: 21000 },
};

export const DEFAULT_SETTINGS: Settings = {
  prices: DEFAULT_PRICES,
  pin: "1234",
  sheetsEndpoint: "",
  invoiceCounter: 0,
};

export interface CartItem {
  id: string;
  variantId: VariantId;
  variantName: string;
  filling?: Filling;
  celup?: Celup;
  tabur?: Tabur;
  quantity: number;
}

export type PaymentMethod = "Cash" | "QRIS" | "Kuantar";

export function tierForPayment(pm: PaymentMethod): PriceTier {
  return pm === "Kuantar" ? "kuantar" : "normal";
}

export interface TransactionItem extends CartItem {
  unitPrice: number;
  priceTier: PriceTier;
}

export interface Transaction {
  id: string;
  timestamp: string;
  items: TransactionItem[];
  subtotal: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  priceTier: PriceTier;
}
