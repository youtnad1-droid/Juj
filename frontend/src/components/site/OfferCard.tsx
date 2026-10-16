import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatPrice, offerPath, salesBucket } from "@/lib/money";
import type { OfferCardDTO } from "@/lib/catalog.schemas";
import { offersInfiniteQuery, type OfferFilter } from "@/lib/queries";
import { useI18n } from "@/i18n";

export function OfferCard({ o }: { o: OfferCardDTO }) {
  const { t } = useI18n();
  const sales = salesBucket(o.sales_count);
  const to = { to: "/catalog/product/$offer", params: { offer: offerPath(o.slug, o.id) } } as const;
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary" data-testid={`offer-card-${o.id}`}>
      <Link {...to} className="block aspect-square overflow-hidden bg-muted">
        {o.image_url && (
          <img src={o.image_url} alt={o.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold" data-testid="offer-card-price">{formatPrice(o.price_minor, o.currency)}</span>
          {o.old_price_minor && (
            <span className="text-sm text-muted-foreground line-through">{formatPrice(o.old_price_minor, o.currency)}</span>
          )}
        </div>
        <Link {...to} className="line-clamp-2 text-sm leading-snug hover:underline" data-testid="offer-card-title">
          {o.title}
        </Link>
        {sales && <span className="text-xs text-muted-foreground">{t("{n} sold", { n: sales })}</span>}
        <Button asChild size="sm" className="mt-auto w-full">
          <Link {...to} data-testid={`offer-card-buy-${o.id}`}>{t("Buy")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function OfferGridView({ items }: { items: OfferCardDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((o) => (
        <OfferCard key={o.id} o={o} />
      ))}
    </div>
  );
}

/** Offers grid with "Show more" (cursor-based load more). */
export function OfferGrid({ filter }: { filter: OfferFilter }) {
  const { t } = useI18n();
  const q = useInfiniteQuery(offersInfiniteQuery(filter));
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isError) return <div className="py-16 text-center text-destructive" data-testid="offers-error">{t("Could not load offers. Please try again.")} <Button variant="link" onClick={() => q.refetch()}>{t("Retry")}</Button></div>;
  if (q.isPending) return <div className="py-16 text-center text-muted-foreground">{t("Loading offers…")}</div>;
  if (!items.length) return <div className="py-16 text-center text-muted-foreground" data-testid="no-offers">{t("No offers found.")}</div>;
  return (
    <div className="space-y-6">
      <OfferGridView items={items} />
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} data-testid="show-more-button">
            {q.isFetchingNextPage ? t("Loading…") : t("Show more")}
          </Button>
        </div>
      )}
    </div>
  );
}
