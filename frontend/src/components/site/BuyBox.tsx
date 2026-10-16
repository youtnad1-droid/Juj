import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Bitcoin, CreditCard, IndianRupee, Minus, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkoutFn } from "@/lib/orders.functions";
import { formatPrice } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import type { fetchOffer } from "@/lib/catalog.functions";

type OfferData = NonNullable<Awaited<ReturnType<typeof fetchOffer>>>;

function useMethodMeta() {
  const { t } = useI18n();
  return {
    stripe: { label: t("Card"), icon: CreditCard },
    paypal: { label: "PayPal", icon: Wallet },
    razorpay: { label: "Razorpay", icon: IndianRupee },
    crypto: { label: t("Crypto"), icon: Bitcoin },
  } as const;
}

export function BuyBox({ data }: { data: OfferData }) {
  const { offer, options, fields, methods } = data;
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const meta = useMethodMeta();
  const [optId, setOptId] = useState(options[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? (f.select_options[0] ?? "") : ""])));
  const [provider, setProvider] = useState(methods.find((m) => m.available)?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const opt = options.find((o) => o.id === optId);
  const unit = opt?.price_minor ?? offer.price_minor;
  const maxQty = Math.max(1, Math.min(10, offer.stock_count));
  const soldOut = offer.stock_count < 1;

  const buy = async () => {
    if (!user) return navigate({ to: "/auth", search: { redirect: path } });
    if (!provider) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await checkoutFn({ data: { offerId: offer.id, optionId: opt?.id, quantity: qty, inputs, provider } });
      if (!r.ok) {
        setErr(r.error);
        setBusy(false);
        return;
      }
      window.location.href = r.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="buy-box">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold" data-testid="offer-price">{formatPrice(unit * qty, offer.currency)}</span>
        {!opt && qty === 1 && offer.old_price_minor && (
          <span className="text-lg text-muted-foreground line-through">{formatPrice(offer.old_price_minor, offer.currency)}</span>
        )}
      </div>
      {options.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="opt">{t("Option")}</Label>
          <select id="opt" data-testid="offer-option-select" value={optId} onChange={(e) => setOptId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label} — {formatPrice(o.price_minor, offer.currency)}</option>
            ))}
          </select>
        </div>
      )}
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={f.key}>{f.label}{f.required && " *"}</Label>
          {f.type === "select" ? (
            <select id={f.key} data-testid={`offer-field-${f.key}`} value={inputs[f.key]} onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2">
              {f.select_options.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <Input id={f.key} data-testid={`offer-field-${f.key}`} value={inputs[f.key]} onChange={(e) => setInputs({ ...inputs, [f.key]: e.target.value })} type={f.type === "number" ? "number" : "text"} maxLength={200} />
          )}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Label>{t("Quantity")}</Label>
        <div className="flex items-center rounded-md border">
          <button type="button" data-testid="qty-minus" className="p-2 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="-"><Minus className="h-4 w-4" /></button>
          <span className="w-8 text-center font-semibold" data-testid="qty-value">{qty}</span>
          <button type="button" data-testid="qty-plus" className="p-2 disabled:opacity-40" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)} aria-label="+"><Plus className="h-4 w-4" /></button>
        </div>
        <span className="text-xs text-muted-foreground">{soldOut ? t("Out of stock") : t("{n} in stock", { n: offer.stock_count })}</span>
      </div>
      <div className="space-y-2">
        <Label>{t("Payment method")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((m) => {
            const M = meta[m.id];
            return (
              <button
                key={m.id}
                type="button"
                data-testid={`payment-method-${m.id}`}
                disabled={!m.available}
                onClick={() => setProvider(m.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-start text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${provider === m.id ? "border-primary bg-accent font-semibold" : "hover:border-primary"}`}
              >
                <M.icon className="h-4 w-4 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <span className="truncate">{M.label}</span>
                  {!m.available && <span className="text-[10px] uppercase leading-tight text-muted-foreground">{t("Not set up")}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {err && <p className="text-sm text-destructive" data-testid="buy-error">{t(err)}</p>}
      <Button size="lg" className="w-full" disabled={busy || soldOut || !provider} onClick={buy} data-testid="buy-button">
        {busy ? t("Redirecting to payment…") : soldOut ? t("Out of stock") : t("Buy now")}
      </Button>
    </div>
  );
}
