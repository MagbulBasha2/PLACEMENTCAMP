import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/states";
import { LabeledField } from "@/components/labeled-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["content_status"];

export const Route = createFileRoute("/_authenticated/admin/tests")({
  head: () => ({
    meta: [
      { title: "Aptitude tests — PlacementCamp admin" },
      {
        name: "description",
        content: "Assemble full timed aptitude tests from your imported question bank.",
      },
      { property: "og:title", content: "Aptitude tests — PlacementCamp admin" },
      {
        property: "og:description",
        content: "Assemble full timed aptitude tests from your imported question bank.",
      },
    ],
  }),
  component: TestsAdmin,
});

type Draft = {
  id?: string;
  title: string;
  description: string;
  minutes: string;
  status: Status;
  questionIds: string[];
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  minutes: "30",
  status: "draft",
  questionIds: [],
};

function TestsAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [topicFilter, setTopicFilter] = useState("all");
  const [formError, setFormError] = useState("");

  const data = useQuery({
    queryKey: ["admin-tests"],
    queryFn: async () => {
      const [tests, links, questions, topics] = await Promise.all([
        supabase.from("aptitude_tests").select("*").order("created_at", { ascending: false }),
        supabase.from("aptitude_test_questions").select("test_id, question_id, order_index"),
        supabase
          .from("aptitude_questions")
          .select("id, question, topic_id, difficulty, status")
          .order("created_at", { ascending: false }),
        supabase.from("aptitude_topics").select("id, name").order("name"),
      ]);
      for (const r of [tests, links, questions, topics]) if (r.error) throw r.error;
      return {
        tests: tests.data ?? [],
        links: links.data ?? [],
        questions: questions.data ?? [],
        topics: topics.data ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (d.title.trim().length < 3) throw new Error("Give the test a title.");
      if (d.questionIds.length === 0) throw new Error("Select at least one question.");
      const minutes = Number(d.minutes) || 0;
      if (minutes < 1) throw new Error("Set a duration in minutes.");

      const payload = {
        title: d.title.trim(),
        description: d.description.trim() || null,
        duration_seconds: minutes * 60,
        status: d.status,
        created_by: user!.id,
      };

      let testId = d.id;
      if (testId) {
        const { error } = await supabase.from("aptitude_tests").update(payload).eq("id", testId);
        if (error) throw error;
        await supabase.from("aptitude_test_questions").delete().eq("test_id", testId);
      } else {
        const { data: created, error } = await supabase
          .from("aptitude_tests")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        testId = created.id;
      }

      const { error: linkError } = await supabase.from("aptitude_test_questions").insert(
        d.questionIds.map((qid, i) => ({
          test_id: testId!,
          question_id: qid,
          order_index: i,
        })),
      );
      if (linkError) throw linkError;

      await logAdminAction({
        actorId: user!.id,
        action: d.id ? "update" : "create",
        entityType: "aptitude_test",
        entityId: testId ?? null,
        details: { questions: d.questionIds.length, status: d.status },
      });
    },
    onSuccess: () => {
      toast.success("Test saved");
      setDraft(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin-tests"] });
      queryClient.invalidateQueries({ queryKey: ["aptitude-tests"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't save this test."),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("aptitude_tests").update({ status }).eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: status,
        entityType: "aptitude_test",
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tests"] });
      queryClient.invalidateQueries({ queryKey: ["aptitude-tests"] });
    },
    onError: () => toast.error("Couldn't change the status."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aptitude_tests").delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "delete",
        entityType: "aptitude_test",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Test deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-tests"] });
      queryClient.invalidateQueries({ queryKey: ["aptitude-tests"] });
    },
    onError: () => toast.error("Couldn't delete this test."),
  });

  if (data.isLoading) return <LoadingState rows={3} />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  if (!data.data) return <LoadingState rows={3} />;

  const d = data.data;
  const countFor = (id: string) => d.links.filter((l) => l.test_id === id).length;
  const publishable = d.questions.filter((q) => q.status === "published");
  const visibleQuestions =
    topicFilter === "all" ? publishable : publishable.filter((q) => q.topic_id === topicFilter);

  return (
    <div>
      <PageHeader
        title="Aptitude tests"
        description="Bundle published questions into full timed tests. Students only see published tests."
        action={
          <Button
            onClick={() => {
              setFormError("");
              setDraft({ ...emptyDraft });
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New test
          </Button>
        }
      />

      {d.tests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tests yet. Create one from your published questions.
        </p>
      ) : (
        <ul className="space-y-3">
          {d.tests.map((t) => (
            <li key={t.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {countFor(t.id)} questions · {Math.round(t.duration_seconds / 60)} minutes
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={t.status === "published" ? "default" : "secondary"}>
                    {t.status.replace("_", " ")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStatus.mutate({
                        id: t.id,
                        status: t.status === "published" ? "archived" : "published",
                      })
                    }
                  >
                    {t.status === "published" ? "Archive" : "Publish"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${t.title}`}
                    onClick={() => {
                      setFormError("");
                      setDraft({
                        id: t.id,
                        title: t.title,
                        description: t.description ?? "",
                        minutes: String(Math.round(t.duration_seconds / 60)),
                        status: t.status,
                        questionIds: d.links
                          .filter((l) => l.test_id === t.id)
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((l) => l.question_id),
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${t.title}`}
                    onClick={() => remove.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit test" : "New test"}</DialogTitle>
            <DialogDescription>
              Only published questions can be added, so students never see drafts.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <LabeledField label="Title">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </LabeledField>
              <LabeledField label="Description">
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </LabeledField>
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledField label="Duration (minutes)">
                  <Input
                    type="number"
                    value={draft.minutes}
                    onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Status">
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v as Status })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledField>
              </div>

              <LabeledField label="Filter questions by topic">
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All topics</SelectItem>
                    {d.topics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>

              <div className="rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">
                  <span>{draft.questionIds.length} selected</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questionIds: [
                          ...new Set([...draft.questionIds, ...visibleQuestions.map((q) => q.id)]),
                        ],
                      })
                    }
                  >
                    Select all shown
                  </Button>
                </div>
                {visibleQuestions.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No published questions here yet. Import or publish questions first.
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y overflow-y-auto">
                    {visibleQuestions.map((q) => (
                      <li key={q.id} className="px-4 py-2">
                        <label className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={draft.questionIds.includes(q.id)}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                questionIds: e.target.checked
                                  ? [...draft.questionIds, q.id]
                                  : draft.questionIds.filter((x) => x !== q.id),
                              })
                            }
                          />
                          <span>
                            <span className="block">{q.question}</span>
                            <span className="block text-xs text-muted-foreground">
                              {q.difficulty}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {formError ? (
                <p className="text-sm font-medium text-destructive">{formError}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
