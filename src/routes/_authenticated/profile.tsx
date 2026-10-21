import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — PlacementCamp" },
      { name: "description", content: "Update your college details, photo and resume." },
      { property: "og:title", content: "Your profile — PlacementCamp" },
      { property: "og:description", content: "Update your college details, photo and resume." },
    ],
  }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  college: z.string().trim().max(150).optional().or(z.literal("")),
  branch: z.string().trim().max(100).optional().or(z.literal("")),
  graduation_year: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d{4}$/.test(v) && +v >= 1990 && +v <= 2100), "Enter a valid year"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s]{7,15}$/.test(v), "Enter a valid phone number"),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
});

function ProfilePage() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const queryClient = useQueryClient();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    college: "",
    branch: "",
    graduation_year: "",
    phone: "",
    bio: "",
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setForm({
      full_name: p.full_name ?? "",
      college: p.college ?? "",
      branch: p.branch ?? "",
      graduation_year: p.graduation_year ? String(p.graduation_year) : "",
      phone: p.phone ?? "",
      bio: p.bio ?? "",
    });
  }, [profileQuery.data]);

  const avatarUrl = useSignedFile(profileQuery.data?.avatar_url ?? null, "avatars");

  const save = useMutation({
    mutationFn: async () => {
      const parsed = profileSchema.safeParse(form);
      if (!parsed.success) {
        const out: Record<string, string> = {};
        for (const i of parsed.error.issues) {
          const k = String(i.path[0] ?? "form");
          if (!out[k]) out[k] = i.message;
        }
        setErrors(out);
        throw new Error("validation");
      }
      setErrors({});
      const { error } = await supabase.from("profiles").upsert({
        id: user!.id,
        email: user!.email ?? null,
        full_name: parsed.data.full_name,
        college: parsed.data.college || null,
        branch: parsed.data.branch || null,
        graduation_year: parsed.data.graduation_year ? Number(parsed.data.graduation_year) : null,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => {
      if ((e as Error).message !== "validation") toast.error("Couldn't save your profile.");
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, bucket }: { file: File; bucket: "avatars" | "resumes" }) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user!.id}/${bucket === "avatars" ? "avatar" : "resume"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { error: updateError } = await supabase.from("profiles").upsert({
        id: user!.id,
        full_name: form.full_name || "Student",
        ...(bucket === "avatars" ? { avatar_url: path } : { resume_url: path }),
      });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("File uploaded");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Upload failed. Files must be under the size limit."),
  });

  if (profileQuery.isLoading) return <LoadingState rows={3} />;
  if (profileQuery.isError)
    return <ErrorState error={profileQuery.error} onRetry={() => profileQuery.refetch()} />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Your profile" description="Only you and admins can see these details." />

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-muted">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your profile photo" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div>
            <Label htmlFor="avatar" className="text-sm font-medium">
              Profile photo
            </Label>
            <Input
              id="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate({ file, bucket: "avatars" });
              }}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border bg-card p-6">
        <TextField
          id="full_name"
          label="Full name"
          value={form.full_name}
          onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
          error={errors["full_name"]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="college"
            label="College"
            value={form.college}
            onChange={(v) => setForm((f) => ({ ...f, college: v }))}
            error={errors["college"]}
          />
          <TextField
            id="branch"
            label="Branch"
            value={form.branch}
            onChange={(v) => setForm((f) => ({ ...f, branch: v }))}
            error={errors["branch"]}
          />
          <TextField
            id="graduation_year"
            label="Graduation year"
            value={form.graduation_year}
            onChange={(v) => setForm((f) => ({ ...f, graduation_year: v }))}
            error={errors["graduation_year"]}
          />
          <TextField
            id="phone"
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            error={errors["phone"]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">About you</Label>
          <Textarea
            id="bio"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
          {errors["bio"] ? (
            <p className="text-xs font-medium text-destructive">{errors["bio"]}</p>
          ) : null}
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </Button>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Resume</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. Stored privately — only you and admins can open it.
        </p>
        <Input
          type="file"
          accept="application/pdf"
          className="mt-3"
          aria-label="Upload resume"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate({ file, bucket: "resumes" });
          }}
        />
        {profileQuery.data?.resume_url ? (
          <p className="mt-2 text-xs text-muted-foreground">A resume is already on file.</p>
        ) : null}
      </section>

    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function useSignedFile(path: string | null, bucket: "avatars" | "resumes") {
  const query = useQuery({
    queryKey: ["signed", bucket, path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 3600);
      if (error) return null;
      return data.signedUrl;
    },
  });
  return query.data ?? null;
}
