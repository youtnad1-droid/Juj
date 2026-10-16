import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "@/lib/admin.functions";
import { formatPrice } from "@/lib/money";
import { PageTitle, StatCard } from "@/components/site/PanelLayout";
import { StatusBadge } from "@/components/site/StatusBadge";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — JUJ" }] }),
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchAdminStats() });
  const s = q.data;
  if (!s) return <p className="text-muted-foreground">{t("Loading…")}</p>;
  return (
    <>
      <PageTitle>{t("Dashboard")}</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard testId="admin-stat-gmv" label={t("Sales volume")} value={formatPrice(s.gmv)} />
        <StatCard testId="admin-stat-commission" label={t("Platform earnings")} value={formatPrice(s.commission)} />
        <StatCard testId="admin-stat-disputes" label={t("Open disputes")} value={s.orders.disputed ?? 0} />
        <StatCard testId="admin-stat-payouts" label={t("Payout requests")} value={s.payouts.n} hint={formatPrice(s.payouts.amount)} />
        <StatCard testId="admin-stat-buyers" label={t("Buyers")} value={s.users.buyer ?? 0} />
        <StatCard testId="admin-stat-sellers" label={t("Sellers")} value={s.users.seller ?? 0} />
        <StatCard testId="admin-stat-offers" label={t("Active offers")} value={`${s.offers.active} / ${s.offers.total}`} />
        <StatCard testId="admin-stat-todo" label={t("Orders to deliver")} value={s.orders.paid ?? 0} />
      </div>
      <section className="space-y-1 rounded-xl border bg-card p-4">
        <h2 className="font-display text-lg font-bold">{t("Recent orders")}</h2>
        {s.recent.map((o) => (
          <Link key={o.id} to="/orders/$id" params={{ id: String(o.id) }} className="flex justify-between gap-2 rounded-lg p-2 text-sm hover:bg-accent">
            <span className="truncate">#{o.id} · {o.offer_title}</span>
            <span className="flex shrink-0 items-center gap-2">{formatPrice(o.total_minor, o.currency)} <StatusBadge status={o.status} /></span>
          </Link>
        ))}
      </section>
    </>
  );
}
