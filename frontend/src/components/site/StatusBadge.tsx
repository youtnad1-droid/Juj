import { useI18n, type T } from "@/i18n";

export const orderStatusLabel = (t: T, s: string) =>
  ({
    pending_payment: t("Awaiting payment"),
    paid: t("Paid"),
    delivered: t("Delivered"),
    completed: t("Completed"),
    disputed: t("Disputed"),
    refunded: t("Refunded"),
    cancelled: t("Cancelled"),
    draft: t("Draft"),
    active: t("Active"),
    paused: t("Paused"),
    archived: t("Archived"),
    requested: t("Requested"),
    rejected: t("Rejected"),
    visible: t("Visible"),
    hidden: t("Hidden"),
    suspended: t("Suspended"),
    banned: t("Banned"),
    verified: t("Verified"),
    unverified: t("Unverified"),
    pending: t("Pending"),
  })[s] ?? s;

const tone: Record<string, string> = {
  pending_payment: "bg-muted text-muted-foreground",
  paid: "bg-chart-4/20 text-foreground",
  delivered: "bg-chart-2/20 text-foreground",
  completed: "bg-primary/25 text-foreground",
  active: "bg-primary/25 text-foreground",
  verified: "bg-primary/25 text-foreground",
  visible: "bg-primary/25 text-foreground",
  disputed: "bg-destructive/15 text-destructive",
  refunded: "bg-destructive/15 text-destructive",
  banned: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span data-testid={`status-${status}`} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone[status] ?? "bg-secondary"}`}>
      {orderStatusLabel(t, status)}
    </span>
  );
}
