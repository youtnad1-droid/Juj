import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPayouts, fetchSellerDashboard, requestPayoutFn } from "@/lib/seller.functions";
import { fmtDate, formatPrice, toMinor } from "@/lib/money";
import { PageTitle, StatCard, selectCls } from "@/components/site/PanelLayout";
import { StatusBadge } from "@/components/site/StatusBadge";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/payouts")({
  head: () => ({ meta: [{ title: "Payouts — JUJ" }] }),
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["seller-dash"], queryFn: () => fetchSellerDashboard() });
  const list = useQuery({ queryKey: ["payouts"], queryFn: () => fetchPayouts() });
  const [f, setF] = useState({ amount: "", method: "bank", details: "" });
  const [busy, setBusy] = useState(false);
  const p = dash.data?.profile;
  return (
    <>
      <PageTitle>{t("Payouts")}</PageTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatCard testId="payout-balance" label={t("Available balance")} value={formatPrice(p?.balance_minor ?? 0)} />
        <StatCard testId="payout-pending" label={t("On hold")} value={formatPrice(p?.pending_minor ?? 0)} />
      </div>
      <form
        className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[140px_160px_1fr_auto] md:items-end"
        data-testid="payout-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const amount = toMinor(f.amount);
          if (Number.isNaN(amount)) return toast.error(t("Enter prices like 4.99"));
          setBusy(true);
          try {
            await requestPayoutFn({ data: { amount_minor: amount, method: f.method, details: f.details } });
            toast.success(t("Payout requested"));
            setF({ amount: "", method: f.method, details: "" });
            qc.invalidateQueries({ queryKey: ["payouts"] });
            qc.invalidateQueries({ queryKey: ["seller-dash"] });
          } catch (err) {
            toast.error(t((err as Error).message.split("\n")[0]));
          }
          setBusy(false);
        }}
      >
        <div className="space-y-1"><Label>{t("Amount (USD)")}</Label><Input required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} data-testid="payout-amount" /></div>
        <div className="space-y-1">
          <Label>{t("Method")}</Label>
          <select className={`${selectCls} w-full`} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} data-testid="payout-method">
            <option value="bank">{t("Bank transfer")}</option><option value="paypal">PayPal</option><option value="crypto">{t("Crypto")}</option><option value="other">{t("Other")}</option>
          </select>
        </div>
        <div className="space-y-1"><Label>{t("Where to send it")}</Label><Input required minLength={3} maxLength={500} placeholder={t("IBAN, PayPal email or wallet address")} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} data-testid="payout-details" /></div>
        <Button disabled={busy} data-testid="payout-submit">{t("Request payout")}</Button>
      </form>
      <ul className="divide-y rounded-xl border bg-card" data-testid="payout-history">
        {(list.data ?? []).map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{formatPrice(x.amount_minor)}</b> · {x.method} · <span className="text-muted-foreground">{x.details}</span></span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">{fmtDate(x.created_at, locale)} <StatusBadge status={x.status} /></span>
            {x.admin_note && <p className="w-full text-xs text-muted-foreground">{x.admin_note}</p>}
          </li>
        ))}
        {list.data && !list.data.length && <li className="p-6 text-center text-muted-foreground">{t("No payouts yet.")}</li>}
      </ul>
    </>
  );
}
