import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Start selling — JUJ" },
      { name: "description", content: "Sell digital goods to buyers worldwide on JUJ." },
      { property: "og:title", content: "Start selling on JUJ" },
      { property: "og:description", content: "Sell digital goods to buyers worldwide on JUJ." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold">Start selling on JUJ</h1>
      <p className="mt-4 text-muted-foreground">The seller dashboard is coming soon. Questions? Write to support@juj.gg.</p>
    </div>
  ),
});
