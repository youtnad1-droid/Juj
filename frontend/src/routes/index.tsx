import { createFileRoute, Link } from "@tanstack/react-router";
import { getRouteApi } from "@tanstack/react-router";
import type { CategoryNode } from "@/lib/catalog.schemas";
import { flatten } from "@/lib/queries";
import { QuickChips } from "@/components/site/Header";
import { OfferGrid } from "@/components/site/OfferCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JUJ — Robux, game keys, gift cards & subscriptions" },
      { name: "description", content: "Shop digital goods from verified sellers. Money is held until you receive your item." },
      { property: "og:title", content: "JUJ — Digital goods marketplace" },
      { property: "og:description", content: "Robux, game keys, gift cards and subscriptions from trusted sellers." },
    ],
  }),
  component: Index,
});

function Index() {
  const tree = getRouteApi("__root__").useLoaderData() as CategoryNode[];
  const all = flatten(tree);
  const tiles = all.filter((c) => c.parent_id === null || c.children.length === 0).slice(0, 8);
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-6">
      <section className="rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
        <h1 className="max-w-xl text-3xl font-bold sm:text-5xl">Digital goods, delivered instantly.</h1>
        <p className="mt-3 max-w-lg opacity-80">Robux, game keys, gift cards and subscriptions from trusted sellers. Your money is held until you get your item.</p>
      </section>
      <QuickChips items={all.filter((c) => c.show_in_header)} />
      <section>
        <h2 className="mb-4 text-2xl font-bold">Categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((c) => (
            <Link
              key={c.id}
              to="/catalog/$categorySlug"
              params={{ categorySlug: c.slug }}
              className="rounded-xl border bg-card p-4 font-display font-semibold transition hover:border-primary hover:bg-accent"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-2xl font-bold">Popular offers</h2>
        <OfferGrid filter={{ sort: "popular" }} />
      </section>
    </div>
  );
}
