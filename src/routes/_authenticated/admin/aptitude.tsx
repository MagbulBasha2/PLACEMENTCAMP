import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { AptitudeImportDialog } from "@/components/aptitude-import";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["content_status"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

export const Route = createFileRoute("/_authenticated/admin/aptitude")({
  head: () => ({
    meta: [
      { title: "Aptitude bank — PlacementCamp admin" },
      { name: "description", content: "Manage aptitude topics and multiple-choice questions." },
      { property: "og:title", content: "Aptitude bank — PlacementCamp admin" },
      { property: "og:description", content: "Manage aptitude topics and multiple-choice questions." },
    ],
  }),
  component: AptitudeAdmin,
});

type TopicDraft = { id?: string; name: string; slug: string; description: string; status: Status };
type QuestionDraft = {
  id?: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: Difficulty;
  status: Status;
};

const emptyTopic: TopicDraft = { name: "", slug: "", description: "", status: "draft" };
const emptyQuestion: QuestionDraft = {
  question: "",
  options: ["", "", "", ""],
  correct_index: 0,
  explanation: "",
  difficulty: "easy",
  status: "draft",
};

function AptitudeAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [topicId, setTopicId] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState<TopicDraft | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft | null>(null);
  const [formError, setFormError] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const topics = useQuery({
    queryKey: ["admin-apt-topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aptitude_topics").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const questions = useQuery({
    queryKey: ["admin-apt-questions", topicId],
    enabled: !!topicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aptitude_questions")
        .select("*")
        .eq("topic_id", topicId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveTopic = useMutation({
    mutationFn: async (draft: TopicDraft) => {
      const name = draft.name.trim();
      if (name.length < 2) throw new Error("Topic name must be at least 2 characters.");
      const slug =
        draft.slug.trim() ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      const payload = {
        name,
        slug,
        description: draft.description.trim() || null,
        status: draft.status,
        created_by: user!.id,
      };
      const { error } = draft.id
        ? await supabase.from("aptitude_topics").update(payload).eq("id", draft.id)
        : await supabase.from("aptitude_topics").insert(payload);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: draft.id ? "update" : "create",
        entityType: "aptitude_topic",
        entityId: draft.id ?? null,
        details: { name, status: draft.status },
      });
    },
    onSuccess: () => {
      toast.success("Topic saved");
      setTopicDraft(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin-apt-topics"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't save this topic."),
  });

  const saveQuestion = useMutation({
    mutationFn: async (draft: QuestionDraft) => {
      const question = draft.question.trim();
      const options = draft.options.map((o) => o.trim()).filter(Boolean);
      if (question.length < 5) throw new Error("Write the full question.");
      if (options.length < 2) throw new Error("Add at least two answer options.");
      if (draft.correct_index >= options.length)
        throw new Error("Pick which option is the correct answer.");
      const payload = {
        topic_id: topicId!,
        question,
        options: options as never,
        correct_index: draft.correct_index,
        explanation: draft.explanation.trim() || null,
        difficulty: draft.difficulty,
        status: draft.status,
        created_by: user!.id,
      };
      const { error } = draft.id
        ? await supabase.from("aptitude_questions").update(payload).eq("id", draft.id)
        : await supabase.from("aptitude_questions").insert(payload);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: draft.id ? "update" : "create",
        entityType: "aptitude_question",
        entityId: draft.id ?? null,
        details: { status: draft.status },
      });
    },
    onSuccess: () => {
      toast.success("Question saved");
      setQuestionDraft(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin-apt-questions"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't save this question."),
  });

  const removeQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aptitude_questions").delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "delete",
        entityType: "aptitude_question",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Question deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-apt-questions"] });
    },
    onError: () => toast.error("Couldn't delete this question."),
  });

  const setTopicStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("aptitude_topics").update({ status }).eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: status,
        entityType: "aptitude_topic",
        entityId: id,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-apt-topics"] }),
    onError: () => toast.error("Couldn't change the status."),
  });

  if (topics.isLoading) return <LoadingState rows={3} />;
  if (topics.isError) return <ErrorState error={topics.error} onRetry={() => topics.refetch()} />;

  const topicRows = topics.data ?? [];

  return (
    <div>
      <PageHeader
        title="Aptitude bank"
        description="Correct answers stay on the server — students never receive them with the questions."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Bulk import
            </Button>
            <Button
              onClick={() => {
                setFormError("");
                setTopicDraft({ ...emptyTopic });
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New topic
            </Button>
          </div>
        }
      />

      <AptitudeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        topics={topicRows.map((t) => ({ id: t.id, name: t.name }))}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Topics</h2>
          {topicRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Create a topic before adding questions.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topicRows.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    "rounded-xl border p-3",
                    topicId === t.id ? "border-primary bg-accent/40" : "",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left text-sm font-medium"
                    onClick={() => setTopicId(t.id)}
                  >
                    {t.name}
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Badge variant={t.status === "published" ? "default" : "secondary"}>
                      {t.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setTopicStatus.mutate({
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
                      aria-label="Edit topic"
                      onClick={() => {
                        setFormError("");
                        setTopicDraft({
                          id: t.id,
                          name: t.name,
                          slug: t.slug,
                          description: t.description ?? "",
                          status: t.status,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Questions</h2>
            <Button
              size="sm"
              disabled={!topicId}
              onClick={() => {
                setFormError("");
                setQuestionDraft({ ...emptyQuestion, options: ["", "", "", ""] });
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add question
            </Button>
          </div>

          {!topicId ? (
            <p className="mt-6 text-sm text-muted-foreground">Select a topic to see its questions.</p>
          ) : questions.isLoading ? (
            <div className="mt-4">
              <LoadingState rows={2} />
            </div>
          ) : (questions.data ?? []).length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No questions in this topic yet. Add your first one.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(questions.data ?? []).map((q) => (
                <li key={q.id} className="rounded-xl border p-4">
                  <p className="text-sm font-medium">{q.question}</p>
                  <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {(q.options as unknown as string[]).map((o, i) => (
                      <li key={i} className={i === q.correct_index ? "font-medium text-success" : ""}>
                        {String.fromCharCode(65 + i)}. {o}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge variant={q.status === "published" ? "default" : "secondary"}>
                      {q.status}
                    </Badge>
                    <Badge variant="outline">{q.difficulty}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit question"
                      onClick={() => {
                        setFormError("");
                        setQuestionDraft({
                          id: q.id,
                          question: q.question,
                          options: q.options as unknown as string[],
                          correct_index: q.correct_index,
                          explanation: q.explanation ?? "",
                          difficulty: q.difficulty,
                          status: q.status,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete question"
                      onClick={() => removeQuestion.mutate(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!topicDraft} onOpenChange={(o) => !o && setTopicDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{topicDraft?.id ? "Edit topic" : "New topic"}</DialogTitle>
          </DialogHeader>
          {topicDraft ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  aria-label="Name"
                  value={topicDraft.name}
                  onChange={(e) => setTopicDraft({ ...topicDraft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  aria-label="Description"
                  rows={3}
                  value={topicDraft.description}
                  onChange={(e) => setTopicDraft({ ...topicDraft, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={topicDraft.status}
                  onValueChange={(v) => setTopicDraft({ ...topicDraft, status: v as Status })}
                >
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formError ? <p className="text-sm font-medium text-destructive">{formError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={saveTopic.isPending}
              onClick={() => topicDraft && saveTopic.mutate(topicDraft)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!questionDraft} onOpenChange={(o) => !o && setQuestionDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{questionDraft?.id ? "Edit question" : "New question"}</DialogTitle>
          </DialogHeader>
          {questionDraft ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Question</Label>
                <Textarea
                  aria-label="Question"
                  rows={3}
                  value={questionDraft.question}
                  onChange={(e) =>
                    setQuestionDraft({ ...questionDraft, question: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Options (mark the correct one)</Label>
                {questionDraft.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={questionDraft.correct_index === i}
                      onChange={() => setQuestionDraft({ ...questionDraft, correct_index: i })}
                      aria-label={`Option ${i + 1} is correct`}
                    />
                    <Input
                      value={o}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      onChange={(e) =>
                        setQuestionDraft({
                          ...questionDraft,
                          options: questionDraft.options.map((x, j) =>
                            j === i ? e.target.value : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setQuestionDraft({
                      ...questionDraft,
                      options: [...questionDraft.options, ""],
                    })
                  }
                >
                  Add option
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Explanation</Label>
                <Textarea
                  aria-label="Explanation"
                  rows={2}
                  value={questionDraft.explanation}
                  onChange={(e) =>
                    setQuestionDraft({ ...questionDraft, explanation: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select
                    value={questionDraft.difficulty}
                    onValueChange={(v) =>
                      setQuestionDraft({ ...questionDraft, difficulty: v as Difficulty })
                    }
                  >
                    <SelectTrigger aria-label="Difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={questionDraft.status}
                    onValueChange={(v) => setQuestionDraft({ ...questionDraft, status: v as Status })}
                  >
                    <SelectTrigger aria-label="Status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending_review">Pending review</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formError ? <p className="text-sm font-medium text-destructive">{formError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={saveQuestion.isPending}
              onClick={() => questionDraft && saveQuestion.mutate(questionDraft)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
