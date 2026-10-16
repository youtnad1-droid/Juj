import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmButton } from "@/components/site/ConfirmButton";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmReceivedFn, disputeFn, fetchOrder, replyReviewFn, retryPaymentFn, reviewFn, sendMessageFn,
} from "@/lib/orders.functions";
import { resolveOrderFn } from "@/lib/admin.functions";
import { fmtDate, formatPrice, offerPath } from "@/lib/money";
import { StatusBadge } from "@/components/site/StatusBadge";
import { StarInput, Stars } from "@/components/site/Stars";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  validateSearch: z.object({ cancelled: z.coerce.number().optional().catch(undefined) }),
  loader: ({ params }) => {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw notFound();
    return { id };
  },
  head: () => ({ meta: [{ title: "Order — JUJ" }] }),
  notFoundComponent: () => <div className="py-24 text-center">Order not found.</div>,
  component: Page,
});

type Detail = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>;

function useAct(id: number) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      await qc.invalidateQueries({ queryKey: ["order", id] });
    } catch (e) {
      toast.error(t((e as Error).message));
    }
    setBusy(false);
  };
  return { busy, run };
}

function Delivery({ d }: { d: Detail }) {
  const { t } = useI18n();
  const items = d.messages.filter((m) => m.kind === "delivery");
  if (!items.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-primary/50 bg-accent p-4" data-testid="order-delivery">
      <p className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" /> {t("Your item")}</p>
      {items.map((m) => (
        <div key={m.id} className="flex items-start gap-2">
          <pre className="flex-1 whitespace-pre-wrap break-all rounded-lg bg-background p-3 font-mono text-sm" data-testid="order-delivery-content">{m.body}</pre>
          <Button size="icon" variant="ghost" aria-label="Copy" data-testid="copy-delivery" onClick={() => { navigator.clipboard.writeText(m.body); toast.success(t("Copied")); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Chat({ d }: { d: Detail }) {
  const { t, locale } = useI18n();
  const { busy, run } = useAct(d.order.id);
  const [body, setBody] = useState("");
  const who = { buyer: t("Buyer"), seller: t("Seller"), admin: t("Support"), system: "JUJ" };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="order-chat">
      <h2 className="font-display text-lg font-bold">{t("Order chat")}</h2>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {d.messages.filter((m) => m.kind !== "delivery").map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.kind === "system" ? "mx-auto bg-muted text-center text-xs text-muted-foreground" : m.mine ? "ms-auto bg-primary/20" : "bg-secondary"}`}>
            {m.kind !== "system" && <p className="text-[11px] font-semibold text-muted-foreground">{who[m.from as keyof typeof who]}</p>}
            <p className="whitespace-pre-wrap break-words">{m.kind === "system" ? t(m.body) : m.body}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDate(m.created_at, locale, true)}</p>
          </div>
        ))}
      </div>
      {d.can.message && (
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} placeholder={d.can.deliver ? t("Write a message, or paste the item to deliver it…") : t("Write a message…")} data-testid="chat-input" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy || !body.trim()} data-testid="chat-send" onClick={() => run(() => sendMessageFn({ data: { orderId: d.order.id, body } }).then(() => setBody("")))}>
              <Send className="h-4 w-4" /> {t("Send")}
            </Button>
            {d.can.deliver && (
              <Button size="sm" disabled={busy || !body.trim()} data-testid="chat-deliver" onClick={() => run(() => sendMessageFn({ data: { orderId: d.order.id, body, deliver: true } }).then(() => setBody("")), t("Marked as delivered"))}>
                <KeyRound className="h-4 w-4" /> {t("Deliver item")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewBox({ d }: { d: Detail }) {
  const { t } = useI18n();
  const { busy, run } = useAct(d.order.id);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reply, setReply] = useState("");
  if (d.review)
    return (
      <section className="space-y-2 rounded-xl border bg-card p-4" data-testid="order-review">
        <h2 className="font-display text-lg font-bold">{t("Review")}</h2>
        <Stars value={d.review.rating} />
        {d.review.comment && <p className="text-sm">{d.review.comment}</p>}
        {d.review.seller_reply && <p className="rounded-lg bg-muted p-2 text-sm">{t("Seller reply")}: {d.review.seller_reply}</p>}
        {d.can.reply && (
          <div className="space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} placeholder={t("Reply to this review…")} data-testid="review-reply-input" />
            <Button size="sm" disabled={busy || !reply.trim()} data-testid="review-reply-submit" onClick={() => run(() => replyReviewFn({ data: { orderId: d.order.id, reply } }), t("Reply posted"))}>{t("Post reply")}</Button>
          </div>
        )}
      </section>
    );
  if (!d.can.review) return null;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" data-testid="review-form">
      <h2 className="font-display text-lg font-bold">{t("Rate the seller")}</h2>
      <StarInput value={rating} onChange={setRating} />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder={t("How was your purchase? (optional)")} data-testid="review-comment" />
      <Button disabled={busy} data-testid="review-submit" onClick={() => run(() => reviewFn({ data: { orderId: d.order.id, rating, comment } }), t("Thanks for your review!"))}>{t("Post review")}</Button>
    </section>
  );
}

function Actions({ d }: { d: Detail }) {
  const { t } = useI18n();
  const { busy, run } = useAct(d.order.id);
  const [reason, setReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  const id = d.order.id;
  return (
    <div className="space-y-3">
      {d.can.pay && (
        <Button className="w-full" disabled={busy} data-testid="order-pay-button" onClick={() => run(async () => {
          const r = await retryPaymentFn({ data: { orderId: id } });
          if (!r.ok) throw new Error(r.error);
          window.location.href = r.url;
        })}>{t("Pay now")}</Button>
      )}
      {d.can.confirm && (
        <ConfirmButton variant="default" className="h-10 w-full" disabled={busy} testId="order-confirm-button" question={t("Did you receive the item? The payment will be released to the seller.")} onConfirm={() => run(() => confirmReceivedFn({ data: { orderId: id } }), t("Thanks! The order is completed."))}>
          <CheckCircle2 className="h-4 w-4" /> {t("I received the item")}
        </ConfirmButton>
      )}
      {d.can.dispute && !disputing && (
        <Button variant="outline" className="w-full" data-testid="order-dispute-button" onClick={() => setDisputing(true)}>
          <AlertTriangle className="h-4 w-4" /> {t("Report a problem")}
        </Button>
      )}
      {disputing && (
        <div className="space-y-2 rounded-xl border p-3">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} placeholder={t("What went wrong?")} data-testid="dispute-reason" />
          <Button variant="destructive" size="sm" disabled={busy || reason.trim().length < 5} data-testid="dispute-submit" onClick={() => run(() => disputeFn({ data: { orderId: id, reason } }), t("Dispute opened"))}>{t("Open dispute")}</Button>
        </div>
      )}
      {d.can.resolve && (
        <div className="space-y-2 rounded-xl border border-dashed p-3" data-testid="admin-order-actions">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{t("Admin")}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} data-testid="admin-release" onClick={() => run(() => resolveOrderFn({ data: { id, action: "release" } }), t("Payment released to the seller"))}>{t("Release to seller")}</Button>
            <Button size="sm" variant="destructive" disabled={busy} data-testid="admin-refund" onClick={() => run(() => resolveOrderFn({ data: { id, action: "refund" } }), t("Order refunded"))}>{t("Refund buyer")}</Button>
          </div>
        </div>
      )}
      {d.can.cancel && (
        <Button size="sm" variant="outline" disabled={busy} data-testid="admin-cancel" onClick={() => run(() => resolveOrderFn({ data: { id, action: "cancel" } }), t("Order cancelled"))}>{t("Cancel order")}</Button>
      )}
    </div>
  );
}

function Page() {
  const { id } = Route.useLoaderData();
  const { cancelled } = Route.useSearch();
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ["order", id], queryFn: () => fetchOrder({ data: { id } }), refetchInterval: 15_000 });
  if (q.isPending) return <p className="py-24 text-center text-muted-foreground">{t("Loading…")}</p>;
  if (!q.data) return <p className="py-24 text-center" data-testid="order-not-found">{t("Order not found.")}</p>;
  const d = q.data;
  const o = d.order;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]" data-testid="order-detail">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl" data-testid="order-title">{t("Order #{id}", { id: o.id })}</h1>
          <StatusBadge status={o.status} />
        </div>
        {cancelled && o.status === "pending_payment" && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm" data-testid="payment-cancelled">{t("The payment was not completed. You can try again.")}</p>
        )}
        <div className="flex gap-4 rounded-xl border bg-card p-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">{o.image_url && <img src={o.image_url} alt="" className="h-full w-full object-cover" />}</div>
          <div className="min-w-0 space-y-1">
            <Link to="/catalog/product/$offer" params={{ offer: offerPath(o.slug, o.offer_id) }} className="font-semibold hover:underline">{o.offer_title}</Link>
            {o.option_label && <p className="text-sm text-muted-foreground">{o.option_label}</p>}
            <p className="text-sm">{formatPrice(o.unit_price_minor, o.currency)} × {o.quantity} = <b data-testid="order-total">{formatPrice(o.total_minor, o.currency)}</b></p>
            <p className="text-xs text-muted-foreground">{t("Seller")}: <Link to="/seller/$id" params={{ id: o.seller_id }} className="underline">{o.seller_name}</Link> · {t("Buyer")}: {o.buyer}</p>
          </div>
        </div>
        {Object.keys(o.inputs).length > 0 && (
          <dl className="grid gap-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2" data-testid="order-inputs">
            {Object.entries(o.inputs).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        )}
        <Delivery d={d} />
        <Chat d={d} />
      </div>
      <aside className="space-y-4">
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm">
          <p className="flex justify-between"><span className="text-muted-foreground">{t("Created")}</span> {fmtDate(o.created_at, locale, true)}</p>
          <p className="flex justify-between"><span className="text-muted-foreground">{t("Paid")}</span> {fmtDate(o.paid_at, locale, true)}</p>
          <p className="flex justify-between"><span className="text-muted-foreground">{t("Delivered")}</span> {fmtDate(o.delivered_at, locale, true)}</p>
          <p className="flex justify-between"><span className="text-muted-foreground">{t("Completed")}</span> {fmtDate(o.completed_at, locale, true)}</p>
          <p className="flex justify-between"><span className="text-muted-foreground">{t("Payment method")}</span> <span className="capitalize">{o.payment_provider}</span></p>
          {d.role !== "buyer" && <p className="flex justify-between"><span className="text-muted-foreground">{t("Platform fee")}</span> {formatPrice(o.commission_minor, o.currency)}</p>}
        </div>
        <Actions d={d} />
        <ReviewBox d={d} />
      </aside>
    </div>
  );
}
