import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, LogOut } from "lucide-react";
import { VARIANTS, type SizeId, type VariantId, DEFAULT_SETTINGS } from "@/lib/pos-types";
import { loadSettings, saveSettings, loadTransactions, formatRp } from "@/lib/pos-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — CHICKEN CRUNCHY ROLL" },
      { name: "description", content: "Panel admin CHICKEN CRUNCHY ROLL: kelola harga, transaksi, dan pengaturan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [settings, setSettings] = useState(() => loadSettings());

  function tryLogin() {
    if (pin === settings.pin) {
      setAuthed(true);
      setPin("");
    } else {
      toast.error("PIN salah");
    }
  }

  if (!authed) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-warm/20 to-sunny/30 px-4">
        <Toaster richColors position="top-center" />
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-warm">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
          <h1 className="text-2xl font-extrabold">Admin Login</h1>
          <p className="mb-4 text-sm text-muted-foreground">Masukkan PIN 4 digit</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              tryLogin();
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em]"
            />
            <Button className="w-full" size="lg">Masuk</Button>
            <p className="text-center text-xs text-muted-foreground">PIN default: 1234</p>
          </form>
        </div>
      </div>
    );
  }

  return <Dashboard settings={settings} onSettingsChange={setSettings} onLogout={() => setAuthed(false)} />;
}

function Dashboard({
  settings,
  onSettingsChange,
  onLogout,
}: {
  settings: ReturnType<typeof loadSettings>;
  onSettingsChange: (s: ReturnType<typeof loadSettings>) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<"tx" | "prices" | "settings">("tx");
  const [transactions, setTransactions] = useState(() => loadTransactions());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    setTransactions(loadTransactions());
  }, [tab]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const t = new Date(tx.timestamp).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86400000) return false;
      return true;
    });
  }, [transactions, from, to]);

  const todayKey = new Date().toDateString();
  const todaySales = transactions
    .filter((t) => new Date(t.timestamp).toDateString() === todayKey)
    .reduce((s, t) => s + t.grandTotal, 0);
  const todayCount = transactions.filter((t) => new Date(t.timestamp).toDateString() === todayKey).length;

  function exportCSV() {
    const headers = [
      "timestamp",
      "transactionId",
      "product",
      "size",
      "filling",
      "celup",
      "tabur",
      "quantity",
      "unitPrice",
      "subtotal",
      "paymentMethod",
      "deliveryFee",
      "grandTotal",
    ];
    const rows: string[] = [headers.join(",")];
    filtered.forEach((tx) => {
      tx.items.forEach((i) => {
        rows.push(
          [
            tx.timestamp,
            tx.id,
            `"${i.variantName}"`,
            i.size,
            i.filling ?? "",
            i.celup ?? "",
            i.tabur ?? "",
            i.quantity,
            i.unitPrice,
            i.unitPrice * i.quantity,
            tx.paymentMethod,
            tx.deliveryFee,
            tx.grandTotal,
          ].join(","),
        );
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-lg p-2 hover:bg-accent">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-extrabold">Admin Dashboard</h1>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Keluar
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {([
            ["tx", "Transaksi"],
            ["prices", "Harga"],
            ["settings", "Pengaturan"],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {l}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {tab === "tx" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Penjualan Hari Ini" value={formatRp(todaySales)} />
              <StatCard label="Transaksi Hari Ini" value={String(todayCount)} />
              <StatCard label="Total Transaksi" value={String(transactions.length)} />
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Dari</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Sampai</label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => { setFrom(""); setTo(""); }}>
                Reset
              </Button>
              <Button onClick={exportCSV} className="ml-auto">
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card">
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Waktu</th>
                          <th className="p-3">ID</th>
                          <th className="p-3">Item</th>
                          <th className="p-3">Bayar</th>
                          <th className="p-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((tx) => (
                          <tr key={tx.id} className="border-t border-border">
                            <td className="p-3">{new Date(tx.timestamp).toLocaleString("id-ID")}</td>
                            <td className="p-3 font-mono text-xs">{tx.id}</td>
                            <td className="p-3">{tx.items.reduce((s, i) => s + i.quantity, 0)} item</td>
                            <td className="p-3">{tx.paymentMethod}</td>
                            <td className="p-3 text-right font-bold text-primary">
                              {formatRp(tx.grandTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile */}
                  <ul className="divide-y divide-border md:hidden">
                    {filtered.map((tx) => (
                      <li key={tx.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">{tx.id}</p>
                            <p className="text-sm">{new Date(tx.timestamp).toLocaleString("id-ID")}</p>
                            <p className="text-xs text-muted-foreground">
                              {tx.items.reduce((s, i) => s + i.quantity, 0)} item • {tx.paymentMethod}
                            </p>
                          </div>
                          <p className="font-bold text-primary">{formatRp(tx.grandTotal)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}

        {tab === "prices" && (
          <PriceManager
            settings={settings}
            onSave={(s) => {
              saveSettings(s);
              onSettingsChange(s);
              toast.success("Harga disimpan");
            }}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={settings}
            onSave={(s) => {
              saveSettings(s);
              onSettingsChange(s);
              toast.success("Pengaturan disimpan");
            }}
          />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function PriceManager({
  settings,
  onSave,
}: {
  settings: ReturnType<typeof loadSettings>;
  onSave: (s: ReturnType<typeof loadSettings>) => void;
}) {
  const [prices, setPrices] = useState({ ...settings.prices });
  const [delivery, setDelivery] = useState(settings.deliveryFee);

  function setPrice(variantId: VariantId, size: SizeId, value: number) {
    setPrices((p) => ({ ...p, [`${variantId}:${size}`]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-4 font-bold">Harga Produk</h2>
        <div className="space-y-3">
          {VARIANTS.map((v) => (
            <div key={v.id} className="rounded-xl border border-border/70 p-3">
              <p className="mb-2 font-semibold">{v.name}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["regular", "jumbo"] as SizeId[]).map((s) => (
                  <label key={s} className="block text-sm">
                    <span className="mb-1 block text-xs uppercase text-muted-foreground">{s}</span>
                    <Input
                      type="number"
                      value={prices[`${v.id}:${s}`] ?? 0}
                      onChange={(e) => setPrice(v.id, s, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-4 font-bold">Biaya Antar (Kuantar)</h2>
        <Input
          type="number"
          value={delivery}
          onChange={(e) => setDelivery(Number(e.target.value))}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onSave({ ...settings, prices, deliveryFee: delivery })}
          size="lg"
        >
          Simpan
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setPrices({ ...DEFAULT_SETTINGS.prices });
            setDelivery(DEFAULT_SETTINGS.deliveryFee);
          }}
        >
          Reset Default
        </Button>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings: ReturnType<typeof loadSettings>;
  onSave: (s: ReturnType<typeof loadSettings>) => void;
}) {
  const [pin, setPin] = useState(settings.pin);
  const [endpoint, setEndpoint] = useState(settings.sheetsEndpoint);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-4 font-bold">Ubah PIN Admin</h2>
        <Input
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="4 digit"
        />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 font-bold">Google Sheets Endpoint</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          URL Web App Apps Script untuk menerima data transaksi. Kosongkan untuk hanya menyimpan lokal.
        </p>
        <Input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://script.google.com/macros/s/.../exec"
        />
      </div>
      <Button
        size="lg"
        onClick={() => {
          if (pin.length !== 4) {
            toast.error("PIN harus 4 digit");
            return;
          }
          onSave({ ...settings, pin, sheetsEndpoint: endpoint });
        }}
      >
        Simpan
      </Button>
    </div>
  );
}
