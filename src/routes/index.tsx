import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2, ShoppingCart, Printer, Wallet, QrCode, Bike } from "lucide-react";
import {
  VARIANTS,
  FILLINGS,
  CELUPS,
  TABURS,
  SIZES,
  SIZE_LABEL,
  tierForPayment,
  type VariantId,
  type Filling,
  type Celup,
  type Tabur,
  type CartItem,
  type PaymentMethod,
  type PriceTier,
  type Size,
  type Transaction,
  type TransactionItem,
} from "@/lib/pos-types";
import {
  loadSettings,
  saveTransaction,
  pushToSheets,
  formatRp,
  nextInvoiceId,
  loadCart,
  saveCart,
  loadPayment,
  savePayment,
} from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CHICKEN CRUNCHY ROLL — Kasir" },
      { name: "description", content: "Sistem kasir CHICKEN CRUNCHY ROLL — pesan, kustomisasi, dan bayar dengan cepat." },
    ],
  }),
  component: PosPage,
});

function PosPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [cart, setCart] = useState<CartItem[]>(() => loadCart<CartItem[]>() ?? []);
  const [activeVariant, setActiveVariant] = useState<VariantId | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    () => (loadPayment() as PaymentMethod) || "Cash",
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [flash, setFlash] = useState(false);

  const tier: PriceTier = tierForPayment(paymentMethod);

  useEffect(() => {
    const reload = () => setSettings(loadSettings());
    window.addEventListener("ccr-settings-changed", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("ccr-settings-changed", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  useEffect(() => saveCart(cart), [cart]);
  useEffect(() => savePayment(paymentMethod), [paymentMethod]);

  // Flash total when payment method changes
  useEffect(() => {
    if (cart.length === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [paymentMethod]);

  function priceFor(variantId: VariantId, size: Size, t: PriceTier = tier): number {
    return settings.prices[variantId]?.[size]?.[t] ?? 0;
  }

  const cartWithPrices = useMemo(
    () => cart.map((i) => ({ ...i, unitPrice: priceFor(i.variantId, i.size), priceTier: tier })),
    [cart, settings.prices, tier],
  );
  const subtotal = useMemo(
    () => cartWithPrices.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [cartWithPrices],
  );
  const grandTotal = subtotal;

  function addToCart(item: CartItem) {
    setCart((c) => [...c, item]);
    toast.success("Ditambahkan ke keranjang");
  }
  function updateQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  }
  function removeItem(id: string) {
    setCart((c) => c.filter((i) => i.id !== id));
  }

  async function confirmPay() {
    setSaving(true);
    const items: TransactionItem[] = cartWithPrices.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      variantName: i.variantName,
      size: i.size,
      filling: i.filling,
      celup: i.celup,
      tabur: i.tabur,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      priceTier: i.priceTier,
    }));
    const tx: Transaction = {
      id: nextInvoiceId(),
      timestamp: new Date().toISOString(),
      items,
      subtotal,
      grandTotal,
      paymentMethod,
      priceTier: tier,
    };
    saveTransaction(tx);
    if (settings.sheetsEndpoint) {
      await pushToSheets(settings.sheetsEndpoint, tx);
    }
    setSaving(false);
    setConfirming(false);
    setPayOpen(false);
    setCart([]);
    setReceipt(tx);
    toast.success("Transaksi berhasil disimpan");
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border/50 bg-gradient-to-r from-warm to-primary text-warm-foreground shadow-warm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-2xl">
              🍗 CHICKEN CRUNCHY ROLL
            </h1>
            <p className="text-xs opacity-90 sm:text-sm">
              Kasir Resmi • <Clock />
            </p>
          </div>
          <a
            href="/admin"
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20 transition hover:bg-white/25 sm:text-sm"
          >
            Admin
          </a>
        </div>
        <PaymentBar paymentMethod={paymentMethod} onChange={setPaymentMethod} />
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Menu • Tarif {tier === "kuantar" ? "Kuantar" : "Normal"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVariant(v.id)}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition hover:shadow-warm hover:border-primary"
              >
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-sunny via-accent to-primary/30 text-5xl">
                  🌯
                </div>
                <div className="space-y-2 p-4">
                  <div>
                    <h3 className="font-bold leading-tight">{v.name}</h3>
                    <p className="text-xs text-muted-foreground">{v.description}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Regular</span>
                      <span className="text-base font-extrabold text-primary">
                        {formatRp(priceFor(v.id, "regular"))}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Jumbo</span>
                      <span className="text-base font-extrabold text-primary">
                        {formatRp(priceFor(v.id, "jumbo"))}
                      </span>
                    </div>
                    <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      Tarif {tier === "kuantar" ? "Kuantar" : "Normal"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-32">
            <CartPanel
              cart={cartWithPrices}
              subtotal={subtotal}
              flash={flash}
              tier={tier}
              onUpdateQty={updateQty}
              onRemove={removeItem}
              onCheckout={() => setPayOpen(true)}
            />
          </div>
        </aside>
      </main>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <button className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-warm">
              <ShoppingCart className="h-5 w-5" />
              <span>Keranjang ({cartCount})</span>
              <span className={`rounded-full bg-white/20 px-2 py-0.5 transition ${flash ? "animate-pulse bg-yellow-300 text-black" : ""}`}>
                {formatRp(subtotal)}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Keranjang</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <CartPanel
                cart={cartWithPrices}
                subtotal={subtotal}
                flash={flash}
                tier={tier}
                onUpdateQty={updateQty}
                onRemove={removeItem}
                onCheckout={() => setPayOpen(true)}
                embedded
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {activeVariant && (
        <CustomizeDialog
          variantId={activeVariant}
          prices={settings.prices[activeVariant]}
          tier={tier}
          onClose={() => setActiveVariant(null)}
          onAdd={(item) => {
            addToCart(item);
            setActiveVariant(null);
          }}
        />
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "Cash", icon: Wallet, label: "Cash" },
              { id: "QRIS", icon: QrCode, label: "QRIS" },
              { id: "Kuantar", icon: Bike, label: "Kuantar" },
            ] as const).map((pm) => {
              const Icon = pm.icon;
              const active = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition ${
                    active ? "border-primary bg-accent text-primary" : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {pm.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5 rounded-xl bg-muted p-4 text-sm">
            <Row label={`Subtotal (${tier === "kuantar" ? "Kuantar" : "Normal"})`} value={formatRp(subtotal)} />
            <div className="my-1 border-t border-border" />
            <Row label="Grand Total" value={formatRp(grandTotal)} bold />
          </div>
          <DialogFooter>
            <Button size="lg" className="w-full" onClick={() => setConfirming(true)} disabled={cart.length === 0}>
              Bayar {formatRp(grandTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={(o) => !saving && setConfirming(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Transaksi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Jumlah item: <b>{cartCount}</b></p>
            <p>Metode: <b>{paymentMethod}</b></p>
            <p>Tarif: <b>{tier === "kuantar" ? "Kuantar" : "Normal"}</b></p>
            <p>Total: <b className="text-primary">{formatRp(grandTotal)}</b></p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>Batal</Button>
            <Button onClick={confirmPay} disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Menyimpan...
                </span>
              ) : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Struk Pembayaran</DialogTitle>
          </DialogHeader>
          {receipt && <Receipt tx={receipt} />}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
            <Button onClick={() => setReceipt(null)}>Selesai</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  return <span>{now.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>;
}

function PaymentBar({
  paymentMethod,
  onChange,
}: {
  paymentMethod: PaymentMethod;
  onChange: (pm: PaymentMethod) => void;
}) {
  const items = [
    { id: "Cash" as const, icon: Wallet, label: "Cash" },
    { id: "QRIS" as const, icon: QrCode, label: "QRIS" },
    { id: "Kuantar" as const, icon: Bike, label: "Kuantar" },
  ];
  return (
    <div className="border-t border-white/10 bg-black/10 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Tarif:</span>
        <div className="flex gap-1.5">
          {items.map((pm) => {
            const Icon = pm.icon;
            const active = paymentMethod === pm.id;
            return (
              <button
                key={pm.id}
                onClick={() => onChange(pm.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  active ? "bg-white text-primary shadow" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {pm.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold text-primary" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

interface PricedCartItem extends CartItem {
  unitPrice: number;
  priceTier: PriceTier;
}

function CartPanel({
  cart,
  subtotal,
  flash,
  tier,
  onUpdateQty,
  onRemove,
  onCheckout,
  embedded,
}: {
  cart: PricedCartItem[];
  subtotal: number;
  flash: boolean;
  tier: PriceTier;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  embedded?: boolean;
}) {
  return (
    <div className={`rounded-2xl ${embedded ? "" : "border border-border bg-card p-4 shadow-sm"}`}>
      {!embedded && (
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <ShoppingCart className="h-4 w-4" /> Keranjang
        </h2>
      )}
      {cart.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada item.</p>
      ) : (
        <ul className="space-y-3">
          {cart.map((item) => (
            <li key={item.id} className="rounded-xl border border-border/70 bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{item.variantName}</p>
                    <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {SIZE_LABEL[item.size]}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.priceTier === "kuantar" ? "bg-orange-500/20 text-orange-700" : "bg-emerald-500/20 text-emerald-700"
                    }`}>
                      {item.priceTier === "kuantar" ? "Kuantar" : "Normal"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[item.filling && `Isi: ${item.filling}`, item.celup && `Celup: ${item.celup}`, item.tabur && `Tabur: ${item.tabur}`]
                      .filter(Boolean).join(" • ") || "Tanpa tambahan"}
                  </p>
                  <p className="mt-1 text-xs">{formatRp(item.unitPrice)}</p>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-muted-foreground transition hover:text-destructive"
                  aria-label="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateQty(item.id, -1)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQty(item.id, 1)}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-bold text-primary">
                  {formatRp(item.unitPrice * item.quantity)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Total ({tier === "kuantar" ? "Kuantar" : "Normal"})
          </span>
          <span className={`text-lg font-extrabold text-primary transition ${flash ? "scale-110 text-yellow-600" : ""}`}>
            {formatRp(subtotal)}
          </span>
        </div>
        <Button size="lg" className="w-full" disabled={cart.length === 0} onClick={onCheckout}>
          Bayar
        </Button>
      </div>
    </div>
  );
}

function CustomizeDialog({
  variantId,
  unitPrice,
  tier,
  onClose,
  onAdd,
}: {
  variantId: VariantId;
  unitPrice: number;
  tier: PriceTier;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}) {
  const variant = VARIANTS.find((v) => v.id === variantId)!;
  const [filling, setFilling] = useState<Filling | undefined>();
  const [sauceMode, setSauceMode] = useState<"none" | "celup" | "tabur">("none");
  const [celup, setCelup] = useState<Celup | undefined>();
  const [tabur, setTabur] = useState<Tabur | undefined>();
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  function handleAdd() {
    if (variant.needsFilling && !filling) {
      setError("Silakan pilih isian terlebih dahulu");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      variantId,
      variantName: variant.name,
      filling: variant.needsFilling ? filling : undefined,
      celup: variant.allowsSauce && sauceMode === "celup" ? celup : undefined,
      tabur: variant.allowsSauce && sauceMode === "tabur" ? tabur : undefined,
      quantity: qty,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{variant.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          <span className="font-bold text-primary">{formatRp(unitPrice)}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            ({tier === "kuantar" ? "Kuantar" : "Normal"})
          </span>
        </p>

        {variant.needsFilling && (
          <Section title="Pilih Isian (wajib)" required>
            <div className="grid grid-cols-3 gap-2">
              {FILLINGS.map((f) => (
                <Chip key={f} active={filling === f} onClick={() => { setFilling(f); setError(""); }}>
                  {f}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        {variant.allowsSauce && (
          <Section title="Pilih Saus (opsional)">
            <div className="mb-2 flex gap-2 text-xs">
              {(["none", "celup", "tabur"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSauceMode(m)}
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    sauceMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {m === "none" ? "Tidak" : m === "celup" ? "Celup" : "Tabur"}
                </button>
              ))}
            </div>
            {sauceMode === "celup" && (
              <div className="grid grid-cols-2 gap-2">
                {CELUPS.map((c) => (
                  <Chip key={c} active={celup === c} onClick={() => setCelup(c)}>{c}</Chip>
                ))}
              </div>
            )}
            {sauceMode === "tabur" && (
              <div className="grid grid-cols-1 gap-2">
                {TABURS.map((t) => (
                  <Chip key={t} active={tabur === t} onClick={() => setTabur(t)}>{t}</Chip>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Jumlah">
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center rounded-full border border-border">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-lg font-bold">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-border">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Section>

        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

        <DialogFooter>
          <Button onClick={handleAdd} size="lg" className="w-full">
            Tambah ke Keranjang • {formatRp(unitPrice * qty)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, required, children,
}: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title} {required && <span className="text-destructive">*</span>}
      </h4>
      {children}
    </div>
  );
}

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
        active ? "border-primary bg-accent text-primary" : "border-border bg-background hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function Receipt({ tx }: { tx: Transaction }) {
  return (
    <div className="font-mono text-xs">
      <div className="text-center">
        <p className="font-bold">CHICKEN CRUNCHY ROLL</p>
        <p>{new Date(tx.timestamp).toLocaleString("id-ID")}</p>
        <p>#{tx.id}</p>
        <p className="text-[10px] uppercase">Tarif {tx.priceTier === "kuantar" ? "Kuantar" : "Normal"}</p>
      </div>
      <div className="my-2 border-t border-dashed border-border" />
      {tx.items.map((i) => (
        <div key={i.id} className="mb-1">
          <div className="flex justify-between">
            <span>{i.variantName} x{i.quantity}</span>
            <span>{formatRp(i.unitPrice * i.quantity)}</span>
          </div>
          {(i.filling || i.celup || i.tabur) && (
            <div className="text-muted-foreground">
              {[i.filling, i.celup, i.tabur].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-border" />
      <div className="flex justify-between font-bold"><span>TOTAL</span><span>{formatRp(tx.grandTotal)}</span></div>
      <div className="flex justify-between"><span>Bayar</span><span>{tx.paymentMethod}</span></div>
      <div className="my-2 border-t border-dashed border-border" />
      <p className="text-center">Terima kasih 🙏</p>
    </div>
  );
}
