import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyReviews } from "@/lib/seller.functions";
import { fmtDate } from "@/lib/money";
import { PageTitle } from "@/components/site/PanelLayout";
import { Stars } from "@/components/site/Stars";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet/reviews")({
  head: () => ({ meta: [{ title: "Reviews — JUJ" }] }),
  component: Page,
});

function Page() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ["my-reviews"], queryFn: () => fetchMyReviews() });
  return (
    <>
      <PageTitle>{t("Reviews")}</PageTitle>
      <div className="space-y-3" data-testid="seller-reviews-list">
        {(q.data ?? []).map((r) => (
          <article key={r.order_id} className="space-y-1 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <Stars value={r.rating} />
              <span className="text-xs text-muted-foreground">{fmtDate(r.created_at, locale)}</span>
            </div>
            {r.comment && <p className="text-sm">{r.comment}</p>}
            <p className="text-xs text-muted-foreground">{r.offer_title}</p>
            {r.seller_reply ? (
              <p className="rounded-lg bg-muted p-2 text-xs">{t("Your reply")}: {r.seller_reply}</p>
            ) : (
              <Link to="/orders/$id" params={{ id: String(r.order_id) }} className="text-xs text-primary underline" data-testid={`reply-review-${r.order_id}`}>{t("Reply")}</Link>
            )}
          </article>
        ))}
        {q.data && !q.data.length && <p className="text-muted-foreground">{t("No reviews yet.")}</p>}
      </div>
    </>
  );
}
