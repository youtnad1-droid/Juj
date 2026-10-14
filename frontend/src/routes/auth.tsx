import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginFn } from "@/lib/catalog.functions";
import { registerSchema } from "@/lib/catalog.schemas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Log in or sign up — JUJ" },
      { name: "description", content: "Log in to your JUJ account or create a new one." },
      { property: "og:title", content: "Log in — JUJ" },
      { property: "og:description", content: "Log in to your JUJ account or create a new one." },
    ],
  }),
  component: AuthPage,
});

const safe = (r?: string) => (r && r.startsWith("/") && !r.startsWith("//") ? r : "/");

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    const r = await loginFn({ data: { email: String(f.get("email")), password: String(f.get("password")) } });
    if (!r.ok) { setBusy(false); return setErr(r.error); }
    await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    setBusy(false);
    navigate({ href: safe(redirect) });
  };

  const onRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = registerSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    setErr(null);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Invalid input");
    setBusy(true);
    const { error } = await supabase.auth.signUp({ ...p.data, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setErr(error.message);
    toast.success("Check your inbox to confirm your email.");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Welcome to JUJ</h1>
      <Tabs defaultValue="login" onValueChange={() => setErr(null)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Log in</TabsTrigger>
          <TabsTrigger value="register">Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={onLogin} className="space-y-4 pt-4">
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Password" type="password" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
            <Link to="/forgot-password" className="block text-center text-sm text-muted-foreground hover:underline">Forgot password?</Link>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={onRegister} className="space-y-4 pt-4">
            <Field name="email" label="Email" type="email" />
            <Field name="password" label="Password (8+ chars, a letter and a number)" type="password" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
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
      <Input id={name} name={name} type={type} required maxLength={254} />
    </div>
  );
}
