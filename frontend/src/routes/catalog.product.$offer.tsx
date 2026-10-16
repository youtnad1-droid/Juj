import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { fetchOffer, setFavoriteFn } from "@/lib/catalog.functions";
import { parseOfferParam, salesBucket } from "@/lib/money";
import { favoritesQuery } from "@/lib/queries";
import { Crumbs } from "@/components/site/Crumbs";
import { BuyBox } from "@/components/site/BuyBox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/catalog/product/$offer")({
  loader: async ({ params }) => {
    const id = parseOfferParam(params.offer);
    if (!id) throw notFound();
    const data = await fetchOffer({ data: { id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.offer.title ?? "Offer";
    const d = loaderData ? loaderData.offer.description.slice(0, 155) || `Buy ${title} on JUJ.` : "Offer unavailable.";
    return {
      meta: [
        { title: `${title} — JUJ` },
        { name: "description", content: d },
        { property: "og:title", content: title },
        { property: "og:description", content: d },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => <div className="py-24 text-center">This offer isn't available.</div>,
  component: OfferPage,
});

function FavoriteButton({ offerId }: { offerId: number }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const favs = useQuery(favoritesQuery(user?.id));
  const isFav = !!favs.data?.some((o) => o.id === offerId);
  const [busy, setBusy] = useState(false);
  if (!user)
    return (
      <Button asChild variant="outline" className="w-full">
        <Link to="/auth" data-testid="favorite-signin-button"><Heart className="h-4 w-4" /> {t("Sign in to save to favorites")}</Link>
      </Button>
    );
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy || favs.isPending}
      data-testid="favorite-toggle-button"
      onClick={async () => {
        setBusy(true);
        try {
          await setFavoriteFn({ data: { offerId, on: !isFav } });
          toast.success(isFav ? t("Removed from favorites") : t("Added to favorites"));
          await qc.invalidateQueries({ queryKey: ["favorites", user.id] });
        } catch {
          toast.error(t("Could not update favorites"));
        }
        setBusy(false);
      }}
    >
      <Heart className={`h-4 w-4 ${isFav ? "fill-primary text-primary" : ""}`} />
      {isFav ? t("In favorites") : t("Add to favorites")}
    </Button>
  );
}

function OfferPage() {
  const data = Route.useLoaderData();
  const { offer, seller, categoryPath } = data;
  const { t, locale } = useI18n();
  const sales = salesBucket(offer.sales_count);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <Crumbs path={categoryPath} last={offer.title} />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl border bg-muted">
          {offer.image_url && <img src={offer.image_url} alt={offer.title} className="h-full w-full object-cover" />}
        </div>
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl" data-testid="offer-title">{offer.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[offer.platform, offer.region, sales && t("{n} sold", { n: sales }), offer.delivery_type === "auto_codes" ? t("Instant delivery") : t("Manual delivery")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <BuyBox data={data} />
          <FavoriteButton offerId={offer.id} />
          <div className="flex gap-3 rounded-xl border border-primary/40 bg-accent p-4 text-sm" data-testid="trust-box">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p>{t("Your money is held by the platform until you receive the item. We refund if it is not received or does not match the description.")}</p>
          </div>
          {seller && (
            <div className="rounded-xl border bg-card p-4" data-testid="seller-card">
              <p className="text-xs uppercase text-muted-foreground">{t("Seller")}</p>
              <Link to="/seller/$id" params={{ id: seller.user_id }} data-testid="seller-card-link" className="font-display text-lg font-semibold hover:underline">{seller.display_name}</Link>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" /> {Number(seller.rating_avg).toFixed(1)} · {t("{n} reviews", { n: seller.rating_count })} · {t("{n} sales", { n: seller.sales_count.toLocaleString(locale) })}
              </p>
            </div>
          )}
        </div>
      </div>
      <section className="max-w-3xl">
        <h2 className="mb-2 text-xl font-bold">{t("About the product")}</h2>
        <p className="whitespace-pre-line text-muted-foreground" data-testid="offer-description">{offer.description}</p>
      </section>
    </div>
  );
}
