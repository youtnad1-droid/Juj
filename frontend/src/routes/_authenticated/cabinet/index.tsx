import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchSellerDashboard, saveSellerProfileFn } from "@/lib/seller.functions";
import { fmtDate, formatPrice } from "@/lib/money";
import { PageTitle, StatCard } from "@/components/site/PanelLayout";
import { StatusBadge } from "@/components/site/StatusBadge";
import { Stars } from "@/components/site/Stars";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/")({
  head: () => ({ meta: [{ title: "Seller cabinet — JUJ" }] }),
  component: Page,
});

type Dash = Awaited<ReturnType<typeof fetchSellerDashboard>>;

function ProfileForm({ p }: { p: Dash["profile"] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ display_name: p.display_name, bio: p.bio ?? "", country: p.country ?? "" });
  useEffect(() => setF({ display_name: p.display_name, bio: p.bio ?? "", country: p.country ?? "" }), [p]);
  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      data-testid="seller-profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await saveSellerProfileFn({ data: f });
          toast.success(t("Saved"));
          qc.invalidateQueries({ queryKey: ["seller-dash"] });
        } catch (err) {
          toast.error(t((err as Error).message));
        }
      }}
    >
      <h2 className="font-display text-lg font-bold">{t("Shop profile")}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1"><Label>{t("Shop name")}</Label><Input value={f.display_name} maxLength={60} onChange={(e) => setF({ ...f, display_name: e.target.value })} data-testid="seller-display-name" /></div>
        <div className="space-y-1"><Label>{t("Country")}</Label><Input value={f.country} maxLength={2} placeholder="US" onChange={(e) => setF({ ...f, country: e.target.value })} data-testid="seller-country" /></div>
      </div>
      <div className="space-y-1"><Label>{t("About your shop")}</Label><Textarea value={f.bio} maxLength={2000} onChange={(e) => setF({ ...f, bio: e.target.value })} data-testid="seller-bio" /></div>
      <Button size="sm" data-testid="seller-profile-save">{t("Save")}</Button>
    </form>
  );
}

function Page() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ["seller-dash"], queryFn: () => fetchSellerDashboard() });
  if (!q.data) return <p className="text-muted-foreground">{t("Loading…")}</p>;
  const { profile: p, offers, orders, recent } = q.data;
  return (
    <>
      <PageTitle action={<Button asChild size="sm" data-testid="dash-new-offer"><Link to="/cabinet/offers/$id" params={{ id: "new" }}>{t("New offer")}</Link></Button>}>
        {p.display_name}
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard testId="stat-balance" label={t("Available balance")} value={formatPrice(p.balance_minor)} hint={t("Ready to withdraw")} />
        <StatCard testId="stat-pending" label={t("On hold")} value={formatPrice(p.pending_minor)} hint={t("Released when orders complete")} />
        <StatCard testId="stat-todo" label={t("Orders to deliver")} value={orders.todo} hint={orders.disputed ? t("{n} disputed", { n: orders.disputed }) : undefined} />
        <StatCard testId="stat-offers" label={t("Active offers")} value={`${offers.active} / ${offers.total}`} />
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 text-sm">
        <Stars value={p.rating_avg} /> <b>{Number(p.rating_avg).toFixed(2)}</b>
        <span className="text-muted-foreground">{t("{n} reviews", { n: p.rating_count })} · {t("{n} sales", { n: p.sales_count })} · {t("Earned")}: {formatPrice(orders.revenue)}</span>
        <StatusBadge status={p.verification_status} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-bold">{t("Recent orders")}</h2>
          {recent.length ? recent.map((o) => (
            <Link key={o.id} to="/orders/$id" params={{ id: String(o.id) }} className="flex items-center justify-between gap-2 rounded-lg p-2 text-sm hover:bg-accent">
              <span className="truncate">#{o.id} · {o.offer_title}</span>
              <span className="flex shrink-0 items-center gap-2">{formatPrice(o.total_minor, o.currency)} <StatusBadge status={o.status} /></span>
            </Link>
          )) : <p className="text-sm text-muted-foreground">{t("No orders yet.")}</p>}
          <p className="text-xs text-muted-foreground">{fmtDate(new Date(), locale)}</p>
        </section>
        <ProfileForm p={p} />
      </div>
    </>
  );
}
