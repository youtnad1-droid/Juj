import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquare, Package, ShoppingBag, Wallet } from "lucide-react";
import { PanelLayout } from "@/components/site/PanelLayout";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/cabinet")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "seller") throw redirect({ to: "/sell" });
  },
  component: Layout,
});

function Layout() {
  const { t } = useI18n();
  const nav = [
    { to: "/cabinet", label: t("Dashboard"), icon: LayoutDashboard, exact: true },
    { to: "/cabinet/offers", label: t("Offers"), icon: Package },
    { to: "/cabinet/orders", label: t("Orders"), icon: ShoppingBag },
    { to: "/cabinet/payouts", label: t("Payouts"), icon: Wallet },
    { to: "/cabinet/reviews", label: t("Reviews"), icon: MessageSquare },
  ];
  return (
    <PanelLayout title={t("Seller cabinet")} nav={nav} testId="seller-cabinet">
      <Outlet />
    </PanelLayout>
  );
}
