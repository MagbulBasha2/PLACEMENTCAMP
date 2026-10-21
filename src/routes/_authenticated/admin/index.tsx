import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — PlacementCamp" },
      { name: "description", content: "Live student activity and content health for PlacementCamp." },
      { property: "og:title", content: "Admin overview — PlacementCamp" },
      { property: "og:description", content: "Live student activity and content health." },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const query = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const [profiles, progress, attempts, topics, pending, audit] = await Promise.all([
        supabase.from("profiles").select("id, created_at"),
        supabase.from("student_problem_progress").select("user_id, status, updated_at"),
        supabase
          .from("aptitude_attempts")
          .select("user_id, topic_id, correct_count, total_questions, created_at"),
        supabase.from("aptitude_topics").select("id, name"),
        supabase.from("interview_experiences").select("id, status"),
        supabase
          .from("admin_audit_logs")
          .select("id, action, entity_type, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      for (const r of [profiles, progress, attempts, topics, pending, audit]) {
        if (r.error) throw r.error;
      }

      const progressRows = progress.data ?? [];
      const attemptRows = attempts.data ?? [];
      const topicName = new Map((topics.data ?? []).map((t) => [t.id, t.name]));

      const active = new Set<string>();
      for (const p of progressRows) if (p.updated_at >= weekAgo) active.add(p.user_id);
      for (const a of attemptRows) if (a.created_at >= weekAgo) active.add(a.user_id);

      const completed = progressRows.filter((p) => p.status === "completed").length;

      const byTopic = new Map<string, number>();
      for (const a of attemptRows) {
        if (!a.topic_id) continue;
        byTopic.set(a.topic_id, (byTopic.get(a.topic_id) ?? 0) + a.total_questions);
      }
      const topTopics = [...byTopic.entries()]
        .map(([id, count]) => ({ name: topicName.get(id) ?? "Unknown", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      return {
        students: profiles.data?.length ?? 0,
        active: active.size,
        completionRate: progressRows.length
          ? Math.round((completed / progressRows.length) * 100)
          : 0,
        attempts: attemptRows.length,
        questionsAttempted: attemptRows.reduce((s, a) => s + a.total_questions, 0),
        pendingExperiences: (pending.data ?? []).filter((e) => e.status === "pending").length,
        topTopics,
        audit: audit.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  if (!query.data) return <LoadingState rows={4} />;
  const d = query.data;

  return (
    <div>
      <PageHeader title="Admin overview" description="Every number below comes from live records." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered students" value={d.students} />
        <Stat label="Active in last 7 days" value={d.active} />
        <Stat label="Roadmap completion" value={`${d.completionRate}%`} />
        <Stat label="Questions attempted" value={d.questionsAttempted} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Stat label="Quiz attempts" value={d.attempts} />
        <Stat label="Experiences awaiting review" value={d.pendingExperiences} />
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Most attempted aptitude topics</h2>
        {d.topTopics.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No quiz attempts recorded yet — the chart fills in as students practise.
          </p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.topTopics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Recent admin activity</h2>
        {d.audit.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No activity yet"
              description="Content changes you make will be recorded here automatically."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y text-sm">
            {d.audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {a.action} · {a.entity_type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
