import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as A from "@/lib/admin.functions";
import { fmtDate, formatPrice } from "@/lib/money";
import { PageTitle, selectCls } from "@/components/site/PanelLayout";
import { StatusBadge, orderStatusLabel } from "@/components/site/StatusBadge";
import { Stars } from "@/components/site/Stars";
import { ConfirmButton } from "@/components/site/ConfirmButton";
import { useI18n } from "@/i18n";

const SECTIONS = ["orders", "users", "offers", "categories", "reviews", "payouts", "settings"] as const;
type Section = (typeof SECTIONS)[number];

export const Route = createFileRoute("/_authenticated/admin/$section")({
  loader: ({ params }) => {
    if (!SECTIONS.includes(params.section as Section)) throw notFound();
    return { section: params.section as Section };
  },
  head: () => ({ meta: [{ title: "Admin — JUJ" }] }),
  component: Page,
});

function useRun(keys: string[]) {
  const qc = useQueryClient();
  const { t } = useI18n();
  return async (fn: () => Promise<unknown>, ok = t("Saved")) => {
    try {
      await fn();
      toast.success(ok);
      for (const k of keys) qc.invalidateQueries({ queryKey: [k] });
    } catch (e) {
      toast.error(t((e as Error).message.split("\n")[0]));
    }
  };
}

const Row = ({ children, id }: { children: ReactNode; id: string }) => (
  <li className="flex flex-wrap items-center gap-2 p-3 text-sm" data-testid={id}>{children}</li>
);
const List = ({ children, id }: { children: ReactNode; id: string }) => <ul className="divide-y rounded-xl border bg-card" data-testid={id}>{children}</ul>;

function Orders() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const d = useQuery({ queryKey: ["admin-orders", status, q], queryFn: () => A.fetchAdminOrders({ data: { status, q } }) });
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder={t("Order #, title or email")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-orders-search" />
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)} data-testid="admin-orders-filter">
          <option value="">{t("All")}</option>
          {["pending_payment", "paid", "delivered", "completed", "disputed", "refunded", "cancelled"].map((s) => <option key={s} value={s}>{orderStatusLabel(t, s)}</option>)}
        </select>
      </div>
      <List id="admin-orders-list">
        {(d.data ?? []).map((o) => (
          <Row key={o.id} id={`admin-order-${o.id}`}>
            <Link to="/orders/$id" params={{ id: String(o.id) }} className="font-semibold underline">#{o.id}</Link>
            <span className="min-w-0 flex-1 truncate">{o.offer_title} · {o.buyer} → {o.seller}</span>
            <span>{formatPrice(o.total_minor, o.currency)}</span>
            <span className="text-xs capitalize text-muted-foreground">{o.payment_provider} · {fmtDate(o.created_at, locale)}</span>
            <StatusBadge status={o.status} />
            <OrderActions id={o.id} status={o.status} />
          </Row>
        ))}
      </List>
    </>
  );
}

function OrderActions({ id, status }: { id: number; status: string }) {
  const { t } = useI18n();
  const run = useRun(["admin-orders", "admin-stats"]);
  const act = (action: "refund" | "release" | "cancel") => run(() => A.resolveOrderFn({ data: { id, action } }));
  return (
    <span className="flex gap-1">
      {["paid", "delivered", "disputed"].includes(status) && (
        <>
          <ConfirmButton variant="outline" testId={`admin-order-release-${id}`} question={t("Complete this order and pay the seller?")} onConfirm={() => act("release")}>{t("Release")}</ConfirmButton>
          <ConfirmButton testId={`admin-order-refund-${id}`} question={t("Refund this order to the buyer?")} onConfirm={() => act("refund")}>{t("Refund")}</ConfirmButton>
        </>
      )}
      {status === "pending_payment" && (
        <ConfirmButton testId={`admin-order-cancel-${id}`} question={t("Cancel this unpaid order?")} onConfirm={() => act("cancel")}>{t("Cancel")}</ConfirmButton>
      )}
    </span>
  );
}

function Users() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const run = useRun(["admin-users", "admin-sellers"]);
  const users = useQuery({ queryKey: ["admin-users", q], queryFn: () => A.fetchAdminUsers({ data: { q } }) });
  const sellers = useQuery({ queryKey: ["admin-sellers"], queryFn: () => A.fetchAdminSellers() });
  return (
    <>
      <h2 className="font-display text-lg font-bold">{t("Sellers")}</h2>
      <List id="admin-sellers-list">
        {(sellers.data ?? []).map((s) => (
          <Row key={s.user_id} id={`admin-seller-${s.user_id}`}>
            <Link to="/seller/$id" params={{ id: s.user_id }} className="font-semibold underline">{s.display_name}</Link>
            <span className="flex-1 text-muted-foreground">{s.email} · {s.offers} {t("Offers")} · ★ {Number(s.rating_avg).toFixed(2)}</span>
            <span>{t("Balance")}: {formatPrice(s.balance_minor)} · {t("On hold")}: {formatPrice(s.pending_minor)}</span>
            <select className={selectCls} value={s.verification_status} data-testid={`admin-seller-verify-${s.user_id}`} onChange={(e) => run(() => A.setSellerVerificationFn({ data: { id: s.user_id, status: e.target.value } }))}>
              {["unverified", "pending", "verified", "rejected"].map((v) => <option key={v} value={v}>{orderStatusLabel(t, v)}</option>)}
            </select>
          </Row>
        ))}
      </List>
      <h2 className="font-display text-lg font-bold">{t("Users")}</h2>
      <Input className="max-w-xs" placeholder={t("Search by email")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-users-search" />
      <List id="admin-users-list">
        {(users.data ?? []).map((u) => (
          <Row key={u.id} id={`admin-user-${u.email}`}>
            <span className="min-w-0 flex-1 truncate font-medium">{u.email}</span>
            {!u.email_verified_at && <Button size="sm" variant="outline" onClick={() => run(() => A.updateUserFn({ data: { id: u.id, verify: true } }))}>{t("Mark email confirmed")}</Button>}
            <select className={selectCls} value={u.role} data-testid={`admin-user-role-${u.email}`} onChange={(e) => run(() => A.updateUserFn({ data: { id: u.id, role: e.target.value } }))}>
              <option value="buyer">{t("Buyer")}</option><option value="seller">{t("Seller")}</option><option value="admin">{t("Admin")}</option>
            </select>
            <select className={selectCls} value={u.status} data-testid={`admin-user-status-${u.email}`} onChange={(e) => run(() => A.updateUserFn({ data: { id: u.id, status: e.target.value } }))}>
              {["active", "suspended", "banned"].map((s) => <option key={s} value={s}>{orderStatusLabel(t, s)}</option>)}
            </select>
          </Row>
        ))}
      </List>
    </>
  );
}

function Offers() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const run = useRun(["admin-offers"]);
  const d = useQuery({ queryKey: ["admin-offers", q], queryFn: () => A.fetchAdminOffers({ data: { q } }) });
  return (
    <>
      <Input className="max-w-xs" placeholder={t("Search offers")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="admin-offers-search" />
      <List id="admin-offers-list">
        {(d.data ?? []).map((o) => (
          <Row key={o.id} id={`admin-offer-${o.id}`}>
            <span className="min-w-0 flex-1 truncate"><b>{o.title}</b> · {o.seller} · {o.category}</span>
            <span>{formatPrice(o.price_minor, o.currency)} · {t("Stock")} {o.stock_count}</span>
            <select className={selectCls} value={o.status} data-testid={`admin-offer-status-${o.id}`} onChange={(e) => run(() => A.setOfferStatusFn({ data: { id: o.id, status: e.target.value } }))}>
              {["active", "paused", "draft", "archived"].map((s) => <option key={s} value={s}>{orderStatusLabel(t, s)}</option>)}
            </select>
          </Row>
        ))}
      </List>
    </>
  );
}

type Cat = Awaited<ReturnType<typeof A.fetchAdminCategories>>[number];
const emptyCat = { id: undefined as string | undefined, parent_id: "", slug: "", name: "", icon: "", seo_text: "", commission_percent: "10", sort_order: "0", show_in_header: false, is_active: true };

function Categories() {
  const { t } = useI18n();
  const run = useRun(["admin-categories", "categories"]);
  const d = useQuery({ queryKey: ["admin-categories"], queryFn: () => A.fetchAdminCategories() });
  const [f, setF] = useState(emptyCat);
  const edit = (c: Cat) => setF({ ...c, parent_id: c.parent_id ?? "", icon: c.icon ?? "", seo_text: c.seo_text ?? "", commission_percent: String(c.commission_percent), sort_order: String(c.sort_order) });
  const name = (id: string | null) => d.data?.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <form className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-3" data-testid="category-form" onSubmit={(e) => {
        e.preventDefault();
        run(() => A.saveCategoryFn({ data: { ...f, parent_id: f.parent_id || null, commission_percent: Number(f.commission_percent), sort_order: Number(f.sort_order) } })).then(() => setF(emptyCat));
      }}>
        <Input required placeholder={t("Name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="category-name" />
        <Input required placeholder="slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} data-testid="category-slug" />
        <select className={selectCls} value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
          <option value="">{t("No parent")}</option>
          {(d.data ?? []).filter((c) => c.id !== f.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input placeholder={t("Commission %")} value={f.commission_percent} onChange={(e) => setF({ ...f, commission_percent: e.target.value })} />
        <Input placeholder={t("Sort order")} value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} />
        <Input placeholder={t("SEO text")} value={f.seo_text} onChange={(e) => setF({ ...f, seo_text: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.show_in_header} onChange={(e) => setF({ ...f, show_in_header: e.target.checked })} /> {t("Show in header")}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> {t("Active")}</label>
        <div className="flex gap-2"><Button size="sm" data-testid="category-save">{f.id ? t("Save") : t("Add category")}</Button>{f.id && <Button size="sm" type="button" variant="ghost" onClick={() => setF(emptyCat)}>{t("Cancel")}</Button>}</div>
      </form>
      <List id="admin-categories-list">
        {(d.data ?? []).map((c) => (
          <Row key={c.id} id={`admin-category-${c.slug}`}>
            <span className="flex-1"><b>{c.name}</b> <span className="text-muted-foreground">/{c.slug} · {name(c.parent_id)} · {c.commission_percent}% · {c.offers} {t("Offers")}</span></span>
            {!c.is_active && <StatusBadge status="hidden" />}
            <Button size="sm" variant="outline" data-testid={`admin-category-edit-${c.slug}`} onClick={() => edit(c)}>{t("Edit")}</Button>
            <ConfirmButton testId={`admin-category-delete-${c.slug}`} question={t("Delete this category?")} onConfirm={() => run(() => A.deleteCategoryFn({ data: { id: c.id } }))}>{t("Delete")}</ConfirmButton>
          </Row>
        ))}
      </List>
    </>
  );
}

function Reviews() {
  const { t, locale } = useI18n();
  const run = useRun(["admin-reviews"]);
  const d = useQuery({ queryKey: ["admin-reviews"], queryFn: () => A.fetchAdminReviews() });
  return (
    <List id="admin-reviews-list">
      {(d.data ?? []).map((r) => (
        <Row key={r.id} id={`admin-review-${r.id}`}>
          <Stars value={r.rating} />
          <span className="min-w-0 flex-1">{r.comment ?? "—"} <span className="text-xs text-muted-foreground">· {r.buyer} → {r.seller} · {fmtDate(r.created_at, locale)}</span></span>
          <StatusBadge status={r.status} />
          <Button size="sm" variant="outline" data-testid={`admin-review-toggle-${r.id}`} onClick={() => run(() => A.setReviewStatusFn({ data: { id: r.id, status: r.status === "visible" ? "hidden" : "visible" } }))}>{r.status === "visible" ? t("Hide") : t("Show")}</Button>
          <ConfirmButton testId={`admin-review-delete-${r.id}`} question={t("Delete this review?")} onConfirm={() => run(() => A.setReviewStatusFn({ data: { id: r.id, status: "delete" } }))}>{t("Delete")}</ConfirmButton>
        </Row>
      ))}
    </List>
  );
}

function Payouts() {
  const { t, locale } = useI18n();
  const run = useRun(["admin-payouts"]);
  const d = useQuery({ queryKey: ["admin-payouts"], queryFn: () => A.fetchAdminPayouts() });
  return (
    <List id="admin-payouts-list">
      {(d.data ?? []).map((p) => (
        <Row key={p.id} id={`admin-payout-${p.id}`}>
          <span className="min-w-0 flex-1"><b>{formatPrice(p.amount_minor)}</b> · {p.seller} · {p.method}: {p.details} <span className="text-xs text-muted-foreground">· {fmtDate(p.created_at, locale)}</span></span>
          <StatusBadge status={p.status} />
          {p.status === "requested" && (
            <>
              <Button size="sm" data-testid={`payout-paid-${p.id}`} onClick={() => run(() => A.processPayoutFn({ data: { id: p.id, action: "paid", note: "" } }))}>{t("Mark as paid")}</Button>
              <ConfirmButton variant="outline" withNote testId={`payout-reject-${p.id}`} question={t("Reject this payout? The amount goes back to the seller's balance.")} onConfirm={(note) => run(() => A.processPayoutFn({ data: { id: p.id, action: "rejected", note } }))}>{t("Reject")}</ConfirmButton>
            </>
          )}
        </Row>
      ))}
      {d.data && !d.data.length && <li className="p-6 text-center text-muted-foreground">{t("No payouts yet.")}</li>}
    </List>
  );
}

function SettingsForm() {
  const { t } = useI18n();
  const run = useRun(["admin-settings"]);
  const d = useQuery({ queryKey: ["admin-settings"], queryFn: () => A.fetchAdminSettings() });
  const [s, setS] = useState(d.data?.settings);
  useEffect(() => setS(d.data?.settings), [d.data]);
  if (!s || !d.data) return <p className="text-muted-foreground">{t("Loading…")}</p>;
  const cfg = d.data.configured;
  return (
    <form className="space-y-4 rounded-xl border bg-card p-4" data-testid="settings-form" onSubmit={(e) => { e.preventDefault(); run(() => A.saveSettingsFn({ data: s })); }}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm">{t("Site name")}<Input value={s.site_name} onChange={(e) => setS({ ...s, site_name: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{t("Support email")}<Input value={s.support_email} onChange={(e) => setS({ ...s, support_email: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{t("Auto-complete delivered orders after (hours)")}<Input type="number" value={s.auto_complete_hours} onChange={(e) => setS({ ...s, auto_complete_hours: Number(e.target.value) })} /></label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("Payment methods")}</p>
        {(Object.keys(s.payment_methods) as (keyof typeof s.payment_methods)[]).map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm capitalize" data-testid={`settings-method-${p}`}>
            <input type="checkbox" checked={s.payment_methods[p]} onChange={(e) => setS({ ...s, payment_methods: { ...s.payment_methods, [p]: e.target.checked } })} />
            {p} {!cfg[p] && <span className="text-xs normal-case text-destructive">— {t("keys missing in .env")}</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" data-testid="settings-save">{t("Save")}</Button>
        <Button size="sm" type="button" variant="outline" data-testid="retranslate" onClick={() => run(() => A.retranslateFn(), t("Translation started. It takes a few minutes."))}>{t("Re-translate all offers and categories")}</Button>
      </div>
    </form>
  );
}

const VIEWS: Record<Section, () => ReactNode> = { orders: Orders, users: Users, offers: Offers, categories: Categories, reviews: Reviews, payouts: Payouts, settings: SettingsForm };

function Page() {
  const { section } = Route.useLoaderData();
  const { t } = useI18n();
  const titles: Record<Section, string> = { orders: t("Orders"), users: t("Users & sellers"), offers: t("Offers"), categories: t("Categories"), reviews: t("Reviews"), payouts: t("Payouts"), settings: t("Settings") };
  const View = VIEWS[section];
  return (
    <>
      <PageTitle>{titles[section]}</PageTitle>
      <View />
    </>
  );
}
