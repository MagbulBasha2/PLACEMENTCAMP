import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { checkAuthRateLimit } from "@/lib/public.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — PlacementCamp" },
      { name: "description", content: "Request a password reset link for your account." },
      { property: "og:title", content: "Reset your password — PlacementCamp" },
      { property: "og:description", content: "Request a password reset link for your account." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const rateLimit = useServerFn(checkAuthRateLimit);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const parsed = z.string().email().max(255).safeParse(email);
    if (!parsed.success) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const gate = await rateLimit({ data: { action: "reset", email } });
      if (!gate.allowed) {
        toast.error(gate.error);
        return;
      }
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="surface-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[var(--shadow-lift)]">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">
            If an account exists for that email, a reset link is on its way. Check your inbox and
            spam folder.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" aria-invalid={!!error} />
                {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Send reset link
              </Button>
            </form>
          </>
        )}
        <div className="mt-6 text-center">
          <Link to="/auth" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
