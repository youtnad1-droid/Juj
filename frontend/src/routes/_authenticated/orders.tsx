import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — JUJ" },
      { name: "description", content: "Your JUJ orders." },
      { property: "og:title", content: "My orders — JUJ" },
      { property: "og:description", content: "Your JUJ orders." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-3xl font-bold">My orders</h1>
      <p className="py-16 text-center text-muted-foreground">No orders yet. Checkout is coming soon.</p>
    </div>
  ),
});
