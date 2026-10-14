import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — JUJ" },
      { name: "description", content: "Reset your JUJ password." },
      { property: "og:title", content: "Forgot password — JUJ" },
      { property: "og:description", content: "Reset your JUJ password." },
    ],
  }),
  component: Page,
});

function Page() {
  const [sent, setSent] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Forgot password</h1>
      {sent ? (
        <p className="text-muted-foreground">If that email has an account, a reset link is on its way.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const email = String(new FormData(e.currentTarget).get("email")).trim();
            await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
            setSent(true);
          }}
        >
          <Field name="email" label="Email" type="email" />
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
    </div>
  );
}
