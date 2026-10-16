import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { FolderTree, LayoutDashboard, MessageSquare, Package, Settings, ShoppingBag, Users, Wallet } from "lucide-react";
import { PanelLayout } from "@/components/site/PanelLayout";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (context.user.role !== "admin") throw redirect({ to: "/" });
  },
  component: Layout,
});

function Layout() {
  const { t } = useI18n();
  const nav = [
    { to: "/admin", label: t("Dashboard"), icon: LayoutDashboard, exact: true },
    { to: "/admin/orders", label: t("Orders"), icon: ShoppingBag },
    { to: "/admin/users", label: t("Users & sellers"), icon: Users },
    { to: "/admin/offers", label: t("Offers"), icon: Package },
    { to: "/admin/categories", label: t("Categories"), icon: FolderTree },
    { to: "/admin/reviews", label: t("Reviews"), icon: MessageSquare },
    { to: "/admin/payouts", label: t("Payouts"), icon: Wallet },
    { to: "/admin/settings", label: t("Settings"), icon: Settings },
  ];
  return (
    <PanelLayout title={t("Admin panel")} nav={nav} testId="admin-panel">
      <Outlet />
    </PanelLayout>
  );
}
