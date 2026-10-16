import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sessionQuery } from "@/lib/catalog.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    const s = await context.queryClient.ensureQueryData(sessionQuery());
    if (!s.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { user: s.user };
  },
  component: () => <Outlet />,
});
