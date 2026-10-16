import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "./auth";
import { forgotPasswordFn } from "@/lib/catalog.functions";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — JUJ" }, { name: "description", content: "Reset your JUJ password." }] }),
  component: Page,
});

function Page() {
  const [sent, setSent] = useState(false);
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t("Forgot password")}</h1>
      {sent ? (
        <p className="text-muted-foreground" data-testid="forgot-sent">{t("If that email has an account, a reset link is on its way.")}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await forgotPasswordFn({ data: { email: String(new FormData(e.currentTarget).get("email")).trim() } });
            setSent(true);
          }}
        >
          <Field name="email" label={t("Email")} type="email" />
          <Button className="w-full" data-testid="forgot-submit">{t("Send reset link")}</Button>
        </form>
      )}
    </div>
  );
}
