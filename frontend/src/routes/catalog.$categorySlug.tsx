import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { fetchCategory } from "@/lib/catalog.functions";
import { OfferGrid } from "@/components/site/OfferCard";
import { Crumbs } from "@/components/site/Crumbs";

const searchSchema = z.object({ sort: z.enum(["popular", "price_asc", "price_desc"]).optional().catch(undefined) });

export const Route = createFileRoute("/catalog/$categorySlug")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ sort: search.sort ?? "popular" }),
  loader: async ({ params, deps, context }) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(params.categorySlug)) throw notFound();
    const data = await fetchCategory({ data: { slug: params.categorySlug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.category.name ?? "Category";
    const desc = loaderData?.category.seo_text ?? `Buy ${name} from trusted sellers on JUJ.`;
    return {
      meta: [
        { title: `${name} — JUJ` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — JUJ` },
        { property: "og:description", content: desc },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: () => <div className="py-24 text-center">Category not found.</div>,
  component: CategoryPage,
});

function CategoryPage() {
  const { category, path, offerCount } = Route.useLoaderData();
  const { sort = "popular" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [showAll, setShowAll] = useState(false);
  const subs = showAll ? category.children : category.children.slice(0, 6);
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <Crumbs path={path} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{category.name}</h1>
          <p className="text-sm text-muted-foreground">{offerCount} offers</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Sort
          <select
            value={sort}
            onChange={(e) => navigate({ search: { sort: e.target.value as typeof sort }, replace: true })}
            className="rounded-md border bg-background px-2 py-1.5"
          >
            <option value="popular">Popular</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>
      {category.children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subs.map((c) => (
            <Link key={c.id} to="/catalog/$categorySlug" params={{ categorySlug: c.slug }} className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:bg-accent">
              {c.name}
            </Link>
          ))}
          {category.children.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="rounded-full px-3 py-1 text-sm text-primary underline-offset-2 hover:underline">
              {showAll ? "Show less" : "Show all"}
            </button>
          )}
        </div>
      )}
      {category.seo_text && <p className="max-w-3xl text-sm text-muted-foreground">{category.seo_text}</p>}
      <OfferGrid filter={{ categorySlug: category.slug, sort }} />
    </div>
  );
}
