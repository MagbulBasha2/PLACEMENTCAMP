import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/aptitude/history")({
  head: () => ({
    meta: [
      { title: "Attempt history — PlacementCamp" },
      { name: "description", content: "Every aptitude attempt you've taken, with topic analytics." },
      { property: "og:title", content: "Attempt history — PlacementCamp" },
      { property: "og:description", content: "Your aptitude attempts and topic-wise accuracy." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["aptitude-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aptitude_attempts")
        .select(
          "id, created_at, correct_count, total_questions, duration_seconds, topic_id, aptitude_topics(name)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const attempts = query.data ?? [];

  if (attempts.length === 0) {
    return (
      <div>
        <PageHeader title="Attempt history" />
        <EmptyState
          title="No attempts yet"
          description="Once you finish a timed quiz, every attempt and your topic accuracy will be listed here."
          action={
            <Button asChild>
              <Link to="/aptitude">Take a quiz</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const trend = [...attempts]
    .reverse()
    .map((a) => ({
      date: new Date(a.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      accuracy: a.total_questions ? Math.round((a.correct_count / a.total_questions) * 100) : 0,
    }));

  const byTopic = new Map<string, { name: string; correct: number; total: number; count: number }>();
  for (const a of attempts) {
    const key = a.topic_id ?? "unknown";
    const cur = byTopic.get(key) ?? {
      name: a.aptitude_topics?.name ?? "Removed topic",
      correct: 0,
      total: 0,
      count: 0,
    };
    cur.correct += a.correct_count;
    cur.total += a.total_questions;
    cur.count += 1;
    byTopic.set(key, cur);
  }

  return (
    <div>
      <PageHeader title="Attempt history" description="Calculated from your saved attempts." />

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Accuracy over time</h2>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis domain={[0, 100]} unit="%" stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.75rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Topic-wise accuracy</h2>
        <ul className="mt-4 divide-y">
          {[...byTopic.values()].map((t) => (
            <li key={t.name} className="flex items-center justify-between py-3 text-sm">
              <span>{t.name}</span>
              <span className="text-muted-foreground">
                {t.total ? Math.round((t.correct / t.total) * 100) : 0}% · {t.count} attempts
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">All attempts</h2>
        <ul className="mt-4 divide-y">
          {attempts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium">{a.aptitude_topics?.name ?? "Removed topic"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <span className="text-muted-foreground">
                {a.correct_count}/{a.total_questions} · {Math.round(a.duration_seconds / 60)} min
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
