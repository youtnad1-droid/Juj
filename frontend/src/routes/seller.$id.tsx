import { createFileRoute, notFound } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { fetchSeller } from "@/lib/catalog.functions";
import { OfferGrid } from "@/components/site/OfferCard";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params, context }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const s = await fetchSeller({ data: { id: params.id } });
    if (!s) throw notFound();
    return s;
  },
  head: ({ loaderData }) => {
    const n = loaderData?.display_name ?? "Seller";
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

function SellerPage() {
  const s = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl font-bold">{s.display_name}</h1>
        {s.bio && <p className="mt-2 max-w-2xl text-muted-foreground">{s.bio}</p>}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" /> {Number(s.rating_avg).toFixed(1)} ({s.rating_count} reviews)</span>
          <span>{s.sales_count.toLocaleString("en-US")} sales</span>
          <span>Member since {new Date(s.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          {s.verification_status === "verified" && <span className="text-success">Verified</span>}
        </div>
      </div>
      <h2 className="text-2xl font-bold">Offers</h2>
      <OfferGrid filter={{ sellerId: s.user_id }} />
    </div>
  );
}
