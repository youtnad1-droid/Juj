import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "./auth";
import { resetPasswordFn } from "@/lib/catalog.functions";
import { useRefreshSession } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().max(200).catch("") }),
  head: () => ({ meta: [{ title: "Set a new password — JUJ" }, { name: "description", content: "Choose a new password for your JUJ account." }] }),
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const refresh = useRefreshSession();
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t("Set a new password")}</h1>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const password = String(new FormData(e.currentTarget).get("password"));
          const r = await resetPasswordFn({ data: { token, password } });
          if (!r.ok) return setErr(r.error);
          toast.success(t("Password updated"));
          await refresh();
          navigate({ to: "/" });
        }}
      >
        <Field name="password" label={t("New password")} type="password" />
        {err && <p className="text-sm text-destructive" data-testid="reset-error">{t(err)}</p>}
        <Button className="w-full" data-testid="reset-submit">{t("Save password")}</Button>
      </form>
    </div>
  );
}
