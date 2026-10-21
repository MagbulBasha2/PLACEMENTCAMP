import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, Timer } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/aptitude/")({
  head: () => ({
    meta: [
      { title: "Aptitude practice — PlacementCamp" },
      {
        name: "description",
        content: "Timed aptitude quizzes with instant scoring, answer review and topic analytics.",
      },
      { property: "og:title", content: "Aptitude practice — PlacementCamp" },
      {
        property: "og:description",
        content: "Timed quizzes, instant scoring and topic-wise accuracy from your own attempts.",
      },
    ],
  }),
  component: AptitudeIndex,
});

function AptitudeIndex() {
  const { user } = useAuth();

  const topicsQuery = useQuery({
    queryKey: ["aptitude-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aptitude_topics")
        .select("id, name, slug, description")
        .eq("status", "published")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const testsQuery = useQuery({
    queryKey: ["aptitude-tests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aptitude_tests")
        .select("id, title, description, duration_seconds, aptitude_test_questions(count)")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["aptitude-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aptitude_attempts")
        .select("topic_id, correct_count, total_questions")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<string, { correct: number; total: number; attempts: number }>();
      for (const a of data ?? []) {
        if (!a.topic_id) continue;
        const cur = map.get(a.topic_id) ?? { correct: 0, total: 0, attempts: 0 };
        cur.correct += a.correct_count;
        cur.total += a.total_questions;
        cur.attempts += 1;
        map.set(a.topic_id, cur);
      }
      return map;
    },
  });

  if (topicsQuery.isLoading) return <LoadingState rows={3} />;
  if (topicsQuery.isError)
    return <ErrorState error={topicsQuery.error} onRetry={() => topicsQuery.refetch()} />;

  const topics = topicsQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Aptitude practice"
        description="Pick a topic, sit a timed set, then review every answer."
        action={
          <Button asChild variant="outline">
            <Link to="/aptitude/history">
              <History className="mr-2 h-4 w-4" aria-hidden />
              Attempt history
            </Link>
          </Button>
        }
      />

      {(testsQuery.data ?? []).length > 0 ? (
        <section className="mb-8">
          <h2 className="text-lg font-semibold">Full timed tests</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(testsQuery.data ?? []).map((t) => (
              <div key={t.id} className="flex flex-col rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{t.title}</h3>
                {t.description ? (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                ) : null}
                <p className="mt-4 text-xs text-muted-foreground">
                  {t.aptitude_test_questions?.[0]?.count ?? 0} questions ·{" "}
                  {Math.round(t.duration_seconds / 60)} minutes
                </p>
                <Button asChild className="mt-4">
                  <Link to="/aptitude/test/$testId" params={{ testId: t.id }}>
                    <Timer className="mr-2 h-4 w-4" aria-hidden />
                    Start test
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {topics.length === 0 ? (
        <EmptyState
          title="No aptitude topics published yet"
          description="Topics and questions are added by the PlacementCamp team. Check back shortly."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((t) => {
            const s = statsQuery.data?.get(t.id);
            const accuracy = s && s.total ? Math.round((s.correct / s.total) * 100) : null;
            return (
              <div key={t.id} className="flex flex-col rounded-2xl border bg-card p-6">
                <h2 className="text-base font-semibold">{t.name}</h2>
                {t.description ? (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                ) : null}
                <p className="mt-4 text-xs text-muted-foreground">
                  {s
                    ? `${s.attempts} attempts · ${accuracy}% accuracy`
                    : "No attempts yet on this topic"}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/aptitude/quiz/$topicId" params={{ topicId: t.id }}>
                    <Timer className="mr-2 h-4 w-4" aria-hidden />
                    Start timed quiz
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
