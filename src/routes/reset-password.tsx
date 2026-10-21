import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — PlacementCamp" },
      { name: "description", content: "Choose a new password for your PlacementCamp account." },
      { property: "og:title", content: "Set a new password — PlacementCamp" },
      {
        property: "og:description",
        content: "Choose a new password for your PlacementCamp account.",
      },
    ],
  }),
  component: ResetPassword,
});

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72)
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady("ok");
    });
    void (async () => {
      const hash = window.location.hash;
      if (hash.includes("type=recovery")) {
        if (active) setReady("ok");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (active) setReady(data.session ? "ok" : "invalid");
    })();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? "form");
        if (!out[k]) out[k] = i.message;
      }
      setErrors(out);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast.error(
          error.message.includes("session")
            ? "This reset link has expired. Request a new one."
            : error.message,
        );
        return;
      }
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="surface-gradient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[var(--shadow-lift)]">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        {ready === "checking" ? (
          <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : null}
        {ready === "invalid" ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Button className="w-full" onClick={() => navigate({ to: "/forgot-password" })}>
              Request a new link
            </Button>
          </div>
        ) : null}
        <form
          onSubmit={onSubmit}
          className={ready === "ok" ? "mt-6 space-y-4" : "hidden"}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" />
            {errors["password"] ? (
              <p className="text-xs font-medium text-destructive">{errors["password"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
            {errors["confirm"] ? (
              <p className="text-xs font-medium text-destructive">{errors["confirm"]}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}
