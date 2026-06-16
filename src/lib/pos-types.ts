export type VariantId = "original" | "filling" | "tabur_celup" | "filling_tabur_celup";
export type SizeId = "regular" | "jumbo";

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

export interface PriceMap {
  // key: `${variantId}:${size}`
  [key: string]: number;
}

export interface Settings {
  prices: PriceMap;
  deliveryFee: number;
  pin: string;
  sheetsEndpoint: string;
}

export const DEFAULT_PRICES: PriceMap = {
  "original:regular": 15000,
  "filling:regular": 17000,
  "tabur_celup:regular": 18000,
  "filling_tabur_celup:regular": 20000,
  "original:jumbo": 25000,
  "filling:jumbo": 27000,
  "tabur_celup:jumbo": 28000,
  "filling_tabur_celup:jumbo": 30000,
};

export const DEFAULT_SETTINGS: Settings = {
  prices: DEFAULT_PRICES,
  deliveryFee: 2500,
  pin: "1234",
  sheetsEndpoint: "",
};

export interface CartItem {
  id: string;
  variantId: VariantId;
  variantName: string;
  size: SizeId;
  filling?: Filling;
  celup?: Celup;
  tabur?: Tabur;
  unitPrice: number;
  quantity: number;
}

export type PaymentMethod = "Cash" | "QRIS" | "Kuantar";

export interface Transaction {
  id: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
}
