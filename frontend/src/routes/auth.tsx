import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginFn, registerFn, resendVerificationFn } from "@/lib/catalog.functions";
import { registerSchema } from "@/lib/catalog.schemas";
import { useRefreshSession } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — JUJ" },
      { name: "description", content: "Log in to your JUJ account or create a new one." },
    ],
  }),
  component: AuthPage,
});

const safe = (r?: string) => (r && r.startsWith("/") && !r.startsWith("//") ? r : "/");

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const refresh = useRefreshSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    setBusy(true);
    setErr(null);
    const r = await loginFn({ data: { email, password: String(f.get("password")) } });
    if (!r.ok) {
      setBusy(false);
      setUnverified(r.error.includes("confirm your email") ? email : null);
      return setErr(r.error);
    }
    await refresh();
    setBusy(false);
    const home = r.role === "admin" ? "/admin" : r.role === "seller" ? "/cabinet" : "/";
    navigate({ href: redirect ? safe(redirect) : home });
  };

  const onRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = registerSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    setErr(null);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    const r = await registerFn({ data: p.data });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast.success(t("Check your inbox to confirm your email."));
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t("Welcome to JUJ")}</h1>
      <Tabs defaultValue="login" onValueChange={() => setErr(null)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login" data-testid="auth-tab-login">{t("Log in")}</TabsTrigger>
          <TabsTrigger value="register" data-testid="auth-tab-register">{t("Sign up")}</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={onLogin} className="space-y-4 pt-4" data-testid="login-form">
            <Field name="email" label={t("Email")} type="email" />
            <Field name="password" label={t("Password")} type="password" />
            {err && <p className="text-sm text-destructive" data-testid="auth-error">{t(err)}</p>}
            {unverified && (
              <button type="button" data-testid="resend-verification" className="text-sm text-primary underline" onClick={async () => {
                await resendVerificationFn({ data: { email: unverified } });
                toast.success(t("If the account exists, a new confirmation email is on its way."));
              }}>{t("Send the confirmation email again")}</button>
            )}
            <Button className="w-full" disabled={busy} data-testid="login-submit">{busy ? t("Logging in…") : t("Log in")}</Button>
            <Link to="/forgot-password" className="block text-center text-sm text-muted-foreground hover:underline" data-testid="forgot-password-link">{t("Forgot password?")}</Link>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={onRegister} className="space-y-4 pt-4" data-testid="register-form">
            <Field name="email" label={t("Email")} type="email" />
            <Field name="password" label={t("Password (8+ chars, a letter and a number)")} type="password" />
            {err && <p className="text-sm text-destructive" data-testid="register-error">{t(err)}</p>}
            <Button className="w-full" disabled={busy} data-testid="register-submit">{busy ? t("Creating…") : t("Create account")}</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function Field({ name, label, type }: { name: string; label: string; type: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required maxLength={254} data-testid={`field-${name}`} />
    </div>
  );
}
