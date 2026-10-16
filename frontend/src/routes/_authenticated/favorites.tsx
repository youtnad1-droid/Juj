import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { favoritesQuery } from "@/lib/queries";
import { OfferGridView } from "@/components/site/OfferCard";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — JUJ" }, { name: "description", content: "Offers you saved on JUJ." }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const { t } = useI18n();
  const q = useQuery(favoritesQuery(user?.id));
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-bold">{t("Favorites")}</h1>
      {q.data?.length ? (
        <OfferGridView items={q.data} />
      ) : (
        <p className="py-16 text-center text-muted-foreground" data-testid="favorites-empty">{q.isPending ? t("Loading…") : t("Nothing saved yet.")}</p>
      )}
    </div>
  );
}
