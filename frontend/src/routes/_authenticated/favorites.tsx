import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { favoritesQuery } from "@/lib/queries";
import { OfferGridView } from "@/components/site/OfferCard";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — JUJ" },
      { name: "description", content: "Offers you saved on JUJ." },
      { property: "og:title", content: "Favorites — JUJ" },
      { property: "og:description", content: "Offers you saved on JUJ." },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const q = useQuery(favoritesQuery(user?.id));
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-bold">Favorites</h1>
      {q.data?.length ? (
        <OfferGridView items={q.data} />
      ) : (
        <p className="py-16 text-center text-muted-foreground">{q.isPending ? "Loading…" : "Nothing saved yet."}</p>
      )}
    </div>
  );
}
