import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, ShieldCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { fetchOffer } from "@/lib/catalog.functions";
import { formatPrice, parseOfferParam, salesBucket } from "@/lib/money";
import { favoritesQuery } from "@/lib/queries";
import { Crumbs } from "@/components/site/Crumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/catalog/product/$offer")({
  loader: async ({ params }) => {
    const id = parseOfferParam(params.offer);
    if (!id) throw notFound();
    const data = await fetchOffer({ data: { id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const t = loaderData?.offer.title ?? "Offer";
    const d = loaderData ? loaderData.offer.description.slice(0, 155) || `Buy ${t} on JUJ.` : "Offer unavailable.";
    return {
      meta: [
        { title: `${t} — JUJ` },
        { name: "description", content: d },
        { property: "og:title", content: t },
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
  const qc = useQueryClient();
  const favs = useQuery(favoritesQuery(user?.id));
  const isFav = !!favs.data?.some((o) => o.id === offerId);
  const [busy, setBusy] = useState(false);
  if (!user)
    return (
      <Button asChild variant="outline" className="w-full">
        <Link to="/auth"><Heart className="h-4 w-4" /> Sign in to save to favorites</Link>
      </Button>
    );
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = isFav
          ? await supabase.from("favorites").delete().eq("offer_id", offerId).eq("user_id", user.id)
          : await supabase.from("favorites").insert({ offer_id: offerId, user_id: user.id });
        setBusy(false);
        if (error) { toast.error("Could not update favorites"); return; }
        toast.success(isFav ? "Removed from favorites" : "Added to favorites");
        qc.invalidateQueries({ queryKey: ["favorites", user.id] });
      }}
    >
      <Heart className={`h-4 w-4 ${isFav ? "fill-primary text-primary" : ""}`} />
      {isFav ? "In favorites" : "Add to favorites"}
    </Button>
  );
}

function OfferPage() {
  const { offer, options, fields, seller, categoryPath } = Route.useLoaderData();
  const [optId, setOptId] = useState(options[0]?.id ?? "");
  const opt = options.find((o) => o.id === optId);
  const price = opt?.price_minor ?? offer.price_minor;
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
            <h1 className="text-2xl font-bold sm:text-3xl">{offer.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[offer.platform, offer.region, sales && `${sales} sold`, offer.delivery_type === "auto_codes" ? "Instant delivery" : "Manual delivery"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl font-bold">{formatPrice(price, offer.currency)}</span>
            {!opt && offer.old_price_minor && (
              <span className="text-lg text-muted-foreground line-through">{formatPrice(offer.old_price_minor, offer.currency)}</span>
            )}
          </div>
          {options.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="opt">Option</Label>
              <select id="opt" value={optId} onChange={(e) => setOptId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">
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
                <select id={f.key} className="w-full rounded-md border bg-background px-3 py-2">
                  {(f.select_options ?? []).map((s) => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <Input id={f.key} type={f.type === "number" ? "number" : "text"} maxLength={200} />
              )}
            </div>
          ))}
          <Button size="lg" className="w-full" disabled title="Checkout is coming soon">Buy — coming soon</Button>
          <FavoriteButton offerId={offer.id} />
          <div className="flex gap-3 rounded-xl border border-primary/40 bg-accent p-4 text-sm">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p>Your money is held by the platform until you receive the item. We refund if it is not received or does not match the description.</p>
          </div>
          {seller && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Seller</p>
              <Link to="/seller/$id" params={{ id: seller.user_id }} className="font-display text-lg font-semibold hover:underline">{seller.display_name}</Link>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-primary text-primary" /> {Number(seller.rating_avg).toFixed(1)} · {seller.rating_count} reviews · {seller.sales_count.toLocaleString("en-US")} sales
              </p>
            </div>
          )}
        </div>
      </div>
      <section className="max-w-3xl">
        <h2 className="mb-2 text-xl font-bold">About the product</h2>
        <p className="whitespace-pre-line text-muted-foreground">{offer.description}</p>
      </section>
    </div>
  );
}
