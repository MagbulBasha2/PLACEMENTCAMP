import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Star, StarOff } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import {
  ExperienceForm,
  emptyExperience,
  toPayload,
  type ExperienceValues,
} from "@/components/experience-form";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import type { Database } from "@/integrations/supabase/types";

type Experience = Database["public"]["Tables"]["interview_experiences"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Moderation — PlacementCamp admin" },
      {
        name: "description",
        content: "Approve, edit, feature or archive student interview submissions.",
      },
      { property: "og:title", content: "Moderation — PlacementCamp admin" },
      {
        property: "og:description",
        content: "Approve, edit, feature or archive student interview submissions.",
      },
    ],
  }),
  component: ModerationPage,
});

function ModerationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<ExperienceValues>({ ...emptyExperience });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["admin-experiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_experiences")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["experience-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("experience_reports")
        .select("id, experience_id, reason, handled, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-experiences"] });
    queryClient.invalidateQueries({ queryKey: ["experiences"] });
  };

  const update = useMutation({
    mutationFn: async ({
      id,
      values: patch,
      action,
    }: {
      id: string;
      values: Database["public"]["Tables"]["interview_experiences"]["Update"];
      action: string;
    }) => {
      const { error } = await supabase.from("interview_experiences").update(patch).eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action,
        entityType: "interview_experience",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Submission updated");
      invalidate();
    },
    onError: () => toast.error("Couldn't update this submission."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interview_experiences").delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "delete",
        entityType: "interview_experience",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Experience deleted");
      invalidate();
    },
    onError: () => toast.error("Couldn't delete this experience."),
  });

  const save = useMutation({
    mutationFn: async () => {
      const result = toPayload(values);
      if ("errors" in result) {
        setErrors(result.errors);
        throw new Error("validation");
      }
      setErrors({});
      const payload = { ...result, rounds: result.rounds as never };

      if (editingId) {
        const { error } = await supabase
          .from("interview_experiences")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        await logAdminAction({
          actorId: user!.id,
          action: "update",
          entityType: "interview_experience",
          entityId: editingId,
        });
        return;
      }

      const duplicate = (query.data ?? []).find(
        (e) =>
          e.company.toLowerCase() === result.company.toLowerCase() &&
          e.role_title.toLowerCase() === result.role_title.toLowerCase() &&
          e.year === result.year,
      );
      if (duplicate) {
        setErrors({ form: "An experience for this company, role and year already exists." });
        throw new Error("validation");
      }

      const { data, error } = await supabase
        .from("interview_experiences")
        .insert({
          ...payload,
          author_id: user!.id,
          status: "approved",
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "create",
        entityType: "interview_experience",
        entityId: data.id,
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Experience updated" : "Experience published");
      setEditorOpen(false);
      setEditingId(null);
      setValues({ ...emptyExperience });
      invalidate();
    },
    onError: (e) => {
      if ((e as Error).message !== "validation") toast.error("Couldn't save this experience.");
    },
  });

  const resolveReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("experience_reports")
        .update({ handled: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report marked handled");
      queryClient.invalidateQueries({ queryKey: ["experience-reports"] });
    },
    onError: () => toast.error("Couldn't update this report."),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const all = query.data ?? [];
  const term = search.trim().toLowerCase();
  const rows = all.filter((e) => {
    if (e.status !== tab) return false;
    if (
      term &&
      ![e.company, e.role_title, e.college ?? ""].some((v) => v.toLowerCase().includes(term))
    )
      return false;
    return true;
  });

  const duplicateKeys = new Map<string, number>();
  for (const e of all) {
    const key = `${e.company.toLowerCase()}|${e.role_title.toLowerCase()}|${e.year ?? ""}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  }
  const isDuplicate = (e: Experience) =>
    (duplicateKeys.get(`${e.company.toLowerCase()}|${e.role_title.toLowerCase()}|${e.year ?? ""}`) ??
      0) > 1;

  const openEditor = (e?: Experience) => {
    setErrors({});
    if (e) {
      setEditingId(e.id);
      setValues({
        company: e.company,
        role_title: e.role_title,
        college: e.college ?? "",
        year: e.year ? String(e.year) : "",
        interview_date: e.interview_date ?? "",
        questions: e.questions ?? "",
        tips: e.tips ?? "",
        outcome: e.outcome,
        is_anonymous: e.is_anonymous,
        rounds:
          ((e.rounds as unknown as { name: string; detail: string }[]) ?? []).length > 0
            ? (e.rounds as unknown as { name: string; detail: string }[])
            : [{ name: "", detail: "" }],
      });
    } else {
      setEditingId(null);
      setValues({ ...emptyExperience });
    }
    setEditorOpen(true);
  };

  const openReports = (reportsQuery.data ?? []).filter((r) => !r.handled);

  return (
    <div>
      <PageHeader
        title="Moderation"
        description="Nothing appears in the student directory until you approve it."
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New experience
          </Button>
        }
      />

      {openReports.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold">Reported experiences</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {openReports.map((r) => {
              const target = all.find((e) => e.id === r.experience_id);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">
                      {target ? `${target.company} — ${target.role_title}` : "Experience"}
                    </span>
                    <span className="text-muted-foreground"> — {r.reason}</span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => resolveReport.mutate(r.id)}>
                    Mark handled
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          className="max-w-xs"
          placeholder="Search company, role or college"
          aria-label="Search submissions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6 space-y-4">
        {rows.length === 0 ? (
          <EmptyState
            title={`No ${tab} submissions`}
            description="Student write-ups land here the moment they are submitted."
          />
        ) : (
          rows.map((e) => (
            <article key={e.id} className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {e.company} — {e.role_title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {[e.college, e.year, e.interview_date].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isDuplicate(e) ? <Badge variant="destructive">Possible duplicate</Badge> : null}
                  {e.is_anonymous ? <Badge variant="outline">Anonymous</Badge> : null}
                  {e.featured ? <Badge>Featured</Badge> : null}
                  <Badge variant="secondary">{e.outcome.replace("_", " ")}</Badge>
                </div>
              </div>

              {((e.rounds as unknown as { name: string; detail: string }[]) ?? []).map((r, i) => (
                <p key={i} className="mt-3 text-sm">
                  <span className="font-medium">{r.name}</span>
                  {r.detail ? <span className="text-muted-foreground"> — {r.detail}</span> : null}
                </p>
              ))}

              {e.questions ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {e.questions}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Moderation note (optional)"
                  className="max-w-sm"
                  aria-label="Moderation note"
                  value={notes[e.id] ?? e.review_note ?? ""}
                  onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={update.isPending || e.status === "approved"}
                  onClick={() =>
                    update.mutate({
                      id: e.id,
                      action: "approve",
                      values: {
                        status: "approved",
                        reviewed_by: user!.id,
                        reviewed_at: new Date().toISOString(),
                        review_note: notes[e.id]?.trim() || null,
                        moderation_note: notes[e.id]?.trim() || null,
                      },
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending || e.status === "rejected"}
                  onClick={() =>
                    update.mutate({
                      id: e.id,
                      action: "reject",
                      values: {
                        status: "rejected",
                        reviewed_by: user!.id,
                        reviewed_at: new Date().toISOString(),
                        review_note: notes[e.id]?.trim() || null,
                        moderation_note: notes[e.id]?.trim() || null,
                      },
                    })
                  }
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: e.id,
                      action: e.featured ? "unfeature" : "feature",
                      values: { featured: !e.featured },
                    })
                  }
                >
                  {e.featured ? (
                    <>
                      <StarOff className="mr-2 h-4 w-4" aria-hidden /> Unfeature
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-4 w-4" aria-hidden /> Feature
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditor(e)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending || e.status === "archived"}
                  onClick={() =>
                    update.mutate({ id: e.id, action: "archive", values: { status: "archived" } })
                  }
                >
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(e.id)}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit experience" : "Publish an experience"}</DialogTitle>
          </DialogHeader>
          <ExperienceForm
            values={values}
            onChange={setValues}
            errors={errors}
            onSubmit={() => save.mutate()}
            submitting={save.isPending}
            submitLabel={editingId ? "Save changes" : "Publish"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
