import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/admin/daily")({
  head: () => ({
    meta: [
      { title: "Daily challenges — PlacementCamp admin" },
      { name: "description", content: "Schedule the question or problem students see each day." },
      { property: "og:title", content: "Daily challenges — PlacementCamp admin" },
      { property: "og:description", content: "Schedule the question or problem students see each day." },
    ],
  }),
  component: DailyAdmin,
});

const NONE = "none";

function DailyAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [questionId, setQuestionId] = useState(NONE);
  const [problemId, setProblemId] = useState(NONE);
  const [note, setNote] = useState("");
  const [publish, setPublish] = useState(true);
  const [formError, setFormError] = useState("");

  const data = useQuery({
    queryKey: ["admin-daily"],
    queryFn: async () => {
      const [challenges, questions, problems] = await Promise.all([
        supabase
          .from("daily_challenges")
          .select("*")
          .order("challenge_date", { ascending: false })
          .limit(60),
        supabase
          .from("aptitude_questions")
          .select("id, question, status")
          .eq("status", "published"),
        supabase.from("problems").select("id, title, status").eq("status", "published"),
      ]);
      for (const r of [challenges, questions, problems]) if (r.error) throw r.error;
      return {
        challenges: challenges.data ?? [],
        questions: questions.data ?? [],
        problems: problems.data ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (questionId === NONE && problemId === NONE)
        throw new Error("Pick an aptitude question, a problem, or both.");
      const payload = {
        challenge_date: date,
        aptitude_question_id: questionId === NONE ? null : questionId,
        problem_id: problemId === NONE ? null : problemId,
        note: note.trim() || null,
        status: (publish ? "published" : "draft") as "published" | "draft",
        created_by: user!.id,
      };
      const { error } = await supabase
        .from("daily_challenges")
        .upsert(payload, { onConflict: "challenge_date" });
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "schedule",
        entityType: "daily_challenge",
        details: { date, status: payload.status },
      });
    },
    onSuccess: () => {
      toast.success("Daily challenge scheduled");
      setFormError("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-daily"] });
      queryClient.invalidateQueries({ queryKey: ["daily-challenge"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't schedule this."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_challenges").delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "delete",
        entityType: "daily_challenge",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["admin-daily"] });
      queryClient.invalidateQueries({ queryKey: ["daily-challenge"] });
    },
    onError: () => toast.error("Couldn't remove this challenge."),
  });

  if (data.isLoading) return <LoadingState rows={3} />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;

  if (!data.data) return <LoadingState rows={3} />;
  const d = data.data;

  return (
    <div>
      <PageHeader
        title="Daily challenges"
        description="One challenge per date. Students only see published ones."
      />

      <section className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Aptitude question</Label>
          <Select value={questionId} onValueChange={setQuestionId}>
            <SelectTrigger aria-label="Aptitude question">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {d.questions.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.question.slice(0, 70)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {d.questions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Publish a question in the aptitude bank first.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Practice problem</Label>
          <Select value={problemId} onValueChange={setProblemId}>
            <SelectTrigger aria-label="Practice problem">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {d.problems.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note to students</Label>
          <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="publish"
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          <Label htmlFor="publish" className="font-normal">
            Publish immediately
          </Label>
        </div>

        {formError ? <p className="text-sm font-medium text-destructive">{formError}</p> : null}

        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Schedule challenge"}
        </Button>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Scheduled</h2>
        {d.challenges.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description="Pick a date above and choose what students should tackle that day."
          />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {d.challenges.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(c.challenge_date).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.note || "No note"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "published" ? "default" : "secondary"}>
                    {c.status}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete challenge"
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
