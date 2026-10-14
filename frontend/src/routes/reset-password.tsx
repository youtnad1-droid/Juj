import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "./auth";
import { passwordSchema } from "@/lib/catalog.schemas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — JUJ" },
      { name: "description", content: "Choose a new password for your JUJ account." },
      { property: "og:title", content: "Set a new password — JUJ" },
      { property: "og:description", content: "Choose a new password for your JUJ account." },
    ],
  }),
  component: Page,
});

function Page() {
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Set a new password</h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = passwordSchema.safeParse(new FormData(e.currentTarget).get("password"));
          if (!p.success) return setErr(p.error.issues[0]?.message ?? "Invalid password");
          const { error } = await supabase.auth.updateUser({ password: p.data });
          if (error) return setErr("This reset link is invalid or expired. Request a new one.");
          toast.success("Password updated");
          navigate({ to: "/" });
        }}
      >
        <Field name="password" label="New password" type="password" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full">Save password</Button>
      </form>
    </div>
  );
}
