import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Flag } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/experiences/$id")({
  head: () => ({
    meta: [
      { title: "Interview experience — PlacementCamp" },
      { name: "description", content: "Rounds, questions and outcome from a student's interview." },
      { property: "og:title", content: "Interview experience — PlacementCamp" },
      {
        property: "og:description",
        content: "Rounds, questions and outcome from a student's interview.",
      },
    ],
  }),
  component: ExperienceDetail,
});

function ExperienceDetail() {
  const { id } = useParams({ from: "/_authenticated/experiences/$id" });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");

  const report = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("experience_reports").insert({
        experience_id: id,
        reporter_id: user!.id,
        reason: reason.trim().slice(0, 1000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — the admins will take a look.");
      setReportOpen(false);
      setReason("");
    },
    onError: () => toast.error("You have already reported this, or it couldn't be sent."),
  });

  const query = useQuery({
    queryKey: ["experience", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_experiences")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const bookmarkQuery = useQuery({
    queryKey: ["bookmark", "interview_experience", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user!.id)
        .eq("entity_type", "interview_experience")
        .eq("entity_id", id)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (bookmarkQuery.data) {
        const { error } = await supabase.from("bookmarks").delete().eq("id", bookmarkQuery.data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user!.id,
          entity_type: "interview_experience",
          entity_id: id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks-full"] });
    },
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const exp = query.data;
  if (!exp) {
    return (
      <EmptyState
        title="Experience not available"
        description="It may have been removed, or it is still awaiting review."
        action={
          <Button asChild>
            <Link to="/experiences">Back to directory</Link>
          </Button>
        }
      />
    );
  }

  const rounds = (exp.rounds as unknown as { name: string; detail: string }[]) ?? [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={exp.company}
        description={[exp.role_title, exp.college, exp.year].filter(Boolean).join(" · ")}
        action={
          <Button variant="outline" onClick={() => toggle.mutate()}>
            {bookmarkQuery.data ? (
              <>
                <BookmarkCheck className="mr-2 h-4 w-4" aria-hidden /> Saved
              </>
            ) : (
              <>
                <Bookmark className="mr-2 h-4 w-4" aria-hidden /> Save
              </>
            )}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            exp.outcome === "selected"
              ? "default"
              : exp.outcome === "rejected"
                ? "destructive"
                : "secondary"
          }
        >
          {exp.outcome.replace("_", " ")}
        </Badge>
        {exp.featured ? <Badge>Featured</Badge> : null}
        {exp.is_anonymous ? <Badge variant="secondary">Shared anonymously</Badge> : null}
        {exp.interview_date ? (
          <Badge variant="outline">Interviewed {exp.interview_date}</Badge>
        ) : null}
        {exp.status !== "approved" ? (
          <Badge variant="outline">{exp.status === "pending" ? "awaiting review" : exp.status}</Badge>
        ) : null}

        {exp.author_id === user?.id && exp.status === "pending" ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/experiences/edit/$id" params={{ id }}>
              Edit submission
            </Link>
          </Button>
        ) : null}
        {exp.status === "approved" && exp.author_id !== user?.id ? (
          <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
            <Flag className="mr-2 h-3.5 w-3.5" aria-hidden />
            Report
          </Button>
        ) : null}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this experience</DialogTitle>
            <DialogDescription>
              Tell the admins what is wrong with it. They review every report.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            aria-label="Reason for reporting"
            placeholder="What is the problem with this write-up?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={report.isPending || reason.trim().length < 5}
              onClick={() => report.mutate()}
            >
              {report.isPending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {exp.status === "rejected" && exp.review_note ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          Reviewer note: {exp.review_note}
        </p>
      ) : null}

      {rounds.length > 0 ? (
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">Rounds</h2>
          <ol className="mt-4 space-y-4">
            {rounds.map((r, i) => (
              <li key={i}>
                <p className="text-sm font-medium">
                  {i + 1}. {r.name}
                </p>
                {r.detail ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {r.detail}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {exp.questions ? (
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">Questions asked</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{exp.questions}</p>
        </section>
      ) : null}

      {exp.tips ? (
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">Advice</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{exp.tips}</p>
        </section>
      ) : null}
    </div>
  );
}
