import { createFileRoute, notFound } from "@tanstack/react-router";
import { MessageSquareReply, Star } from "lucide-react";
import { fetchSeller } from "@/lib/catalog.functions";
import { OfferGrid } from "@/components/site/OfferCard";
import { Stars } from "@/components/site/Stars";
import { fmtDate } from "@/lib/money";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const s = await fetchSeller({ data: { id: params.id } });
    if (!s) throw notFound();
    return s;
  },
  head: ({ loaderData }) => {
    const n = loaderData?.seller.display_name ?? "Seller";
    return {
      meta: [
        { title: `${n} — Seller on JUJ` },
        { name: "description", content: `Offers from ${n} on JUJ.` },
        { property: "og:title", content: `${n} on JUJ` },
        { property: "og:description", content: `Offers from ${n} on JUJ.` },
      ],
    };
  },
  notFoundComponent: () => <div className="py-24 text-center">Seller not found.</div>,
  component: SellerPage,
});

function Reviews() {
  const { reviews } = Route.useLoaderData();
  const { t, locale } = useI18n();
  if (!reviews.length) return <p className="text-sm text-muted-foreground" data-testid="no-reviews">{t("No reviews yet.")}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="seller-reviews">
      {reviews.map((r) => (
        <article key={r.id} className="space-y-2 rounded-xl border bg-card p-4" data-testid={`review-${r.id}`}>
          <div className="flex items-center justify-between gap-2">
            <Stars value={r.rating} />
            <span className="text-xs text-muted-foreground">{fmtDate(r.created_at, locale)}</span>
          </div>
          {r.comment && <p className="text-sm">{r.comment}</p>}
          <p className="text-xs text-muted-foreground">{r.buyer} · {r.offer_title}</p>
          {r.seller_reply && (
            <p className="flex gap-2 rounded-lg bg-muted p-2 text-xs"><MessageSquareReply className="h-4 w-4 shrink-0" /> {r.seller_reply}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function SellerPage() {
  const { seller: s } = Route.useLoaderData();
  const { t, locale } = useI18n();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl font-bold" data-testid="seller-name">{s.display_name}</h1>
        {s.bio && <p className="mt-2 max-w-2xl text-muted-foreground">{s.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1" data-testid="seller-rating"><Star className="h-4 w-4 fill-primary text-primary" /> {Number(s.rating_avg).toFixed(1)} ({t("{n} reviews", { n: s.rating_count })})</span>
          <span>{t("{n} sales", { n: s.sales_count.toLocaleString(locale) })}</span>
          <span>{t("Member since {date}", { date: new Date(s.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" }) })}</span>
          {s.verification_status === "verified" && <span className="text-success">{t("Verified")}</span>}
        </div>
      </div>
      <h2 className="text-2xl font-bold">{t("Offers")}</h2>
      <OfferGrid filter={{ sellerId: s.user_id }} />
      <h2 className="text-2xl font-bold">{t("Buyer reviews")}</h2>
      <Reviews />
    </div>
  );
}
