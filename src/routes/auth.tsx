import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { checkAuthRateLimit } from "@/lib/public.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — PlacementCamp" },
      {
        name: "description",
        content:
          "Sign in or create your PlacementCamp account to track your campus placement preparation.",
      },
      { property: "og:title", content: "Sign in — PlacementCamp" },
      {
        property: "og:description",
        content: "Access your placement roadmap, aptitude practice and interview experiences.",
      },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(72)
    .regex(/[A-Za-z]/, "Include a letter")
    .regex(/[0-9]/, "Include a number"),
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Enter your password").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const rateLimit = useServerFn(checkAuthRateLimit);

  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkEmail, setCheckEmail] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const gate = await rateLimit({ data: { action: "login", email: parsed.data.email } });
      if (!gate.allowed) {
        toast.error(gate.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        toast.error(
          error.message.toLowerCase().includes("invalid")
            ? "Email or password is incorrect."
            : error.message,
        );
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: form.get("fullName"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const gate = await rateLimit({ data: { action: "signup", email: parsed.data.email } });
      if (!gate.allowed) {
        toast.error(gate.error);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        setCheckEmail(parsed.data.email);
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        toast.error("Google sign-in failed. Please try again.");
      }
      // On success the browser is redirected to Google.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="surface-gradient flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2 font-display text-lg font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-5 w-5" aria-hidden />
        </span>
        PlacementCamp
      </Link>

      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-8">
        {checkEmail ? (
          <div className="space-y-4 text-center">
            <h1 className="text-xl font-semibold">Confirm your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <strong>{checkEmail}</strong>. Click it to activate
              your account, then come back and sign in.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setCheckEmail(null)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <Field
                  id="signin-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  error={errors["email"]}
                />
                <Field
                  id="signin-password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  error={errors["password"]}
                />
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                <Field
                  id="signup-name"
                  name="fullName"
                  label="Full name"
                  autoComplete="name"
                  error={errors["fullName"]}
                />
                <Field
                  id="signup-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  error={errors["email"]}
                />
                <Field
                  id="signup-password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  hint="At least 8 characters, with a letter and a number."
                  error={errors["password"]}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={busy}
            >
              Continue with Google
            </Button>
          </Tabs>
        )}
      </div>
    </main>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  hint,
  error,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
