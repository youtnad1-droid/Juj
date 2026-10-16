import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { OfferGrid } from "@/components/site/OfferCard";
import { useRootData } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";

const schema = z.object({
  q: z.string().max(100).catch(""),
  category: z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined),
});

export const Route = createFileRoute("/search")({
  validateSearch: schema,
  head: () => ({
    meta: [
      { title: "Search — JUJ" },
      { name: "description", content: "Search digital goods on JUJ." },
      { property: "og:title", content: "Search — JUJ" },
      { property: "og:description", content: "Search digital goods on JUJ." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { tree } = useRootData();
  const { t } = useI18n();
  const term = q.trim();
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold" data-testid="search-title">{term ? t("Results for “{q}”", { q: term }) : t("Search")}</h1>
      <div className="flex flex-wrap gap-2">
        {[{ slug: undefined, name: t("All") }, ...tree].map((c) => (
          <button
            key={c.slug ?? "all"}
            data-testid={`search-filter-${c.slug ?? "all"}`}
            onClick={() => navigate({ search: { q, category: c.slug }, replace: true })}
            className={`rounded-full border px-3 py-1 text-sm ${category === c.slug ? "border-primary bg-accent" : "hover:border-primary"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {term ? (
        <OfferGrid filter={{ q: term, categorySlug: category }} />
      ) : (
        <p className="py-16 text-center text-muted-foreground">{t("Type in the search bar above to find offers.")}</p>
      )}
    </div>
  );
}
