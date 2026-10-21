import { createFileRoute, Link } from "@tanstack/react-router";
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
import { CalendarCheck, CheckCircle2, Target, Timer } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PlacementCamp" },
      { name: "description", content: "Your live placement preparation progress." },
      { property: "og:title", content: "Dashboard — PlacementCamp" },
      { property: "og:description", content: "Your live placement preparation progress." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const query = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [problems, progress, attempts, daily] = await Promise.all([
        supabase.from("problems").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase
          .from("student_problem_progress")
          .select("status, updated_at, problem_id, problems(title, difficulty)")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("aptitude_attempts")
          .select("id, correct_count, total_questions, created_at, aptitude_topics(name)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("daily_challenges")
          .select("id, challenge_date")
          .eq("status", "published")
          .lte("challenge_date", new Date().toISOString().slice(0, 10))
          .order("challenge_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (problems.error) throw problems.error;
      if (progress.error) throw progress.error;
      if (attempts.error) throw attempts.error;

      return {
        totalProblems: problems.count ?? 0,
        progress: progress.data ?? [],
        attempts: attempts.data ?? [],
        todayChallenge: daily.data,
      };
    },
  });

  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  if (!query.data) return <LoadingState rows={4} />;
  const data = query.data;
  const completed = data.progress.filter((p) => p.status === "completed").length;
  const inProgress = data.progress.filter((p) => p.status === "in_progress").length;
  const completionRate = data.totalProblems ? Math.round((completed / data.totalProblems) * 100) : 0;

  const totalAnswered = data.attempts.reduce((s, a) => s + a.total_questions, 0);
  const totalCorrect = data.attempts.reduce((s, a) => s + a.correct_count, 0);
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const chartData = [...data.attempts]
    .reverse()
    .slice(-8)
    .map((a, i) => ({
      name: `#${i + 1}`,
      accuracy: a.total_questions ? Math.round((a.correct_count / a.total_questions) * 100) : 0,
    }));

  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Your dashboard"}
        description="Every number here is calculated from what you have actually done."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Problems completed"
          value={`${completed}`}
          sub={data.totalProblems ? `of ${data.totalProblems} published` : "no problems published yet"}
        />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="Roadmap completion"
          value={`${completionRate}%`}
          sub={`${inProgress} in progress`}
        />
        <Stat
          icon={<Timer className="h-4 w-4" />}
          label="Aptitude attempts"
          value={`${data.attempts.length}`}
          sub={totalAnswered ? `${totalAnswered} questions attempted` : "no attempts yet"}
        />
        <Stat
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Aptitude accuracy"
          value={totalAnswered ? `${accuracy}%` : "—"}
          sub={totalAnswered ? `${totalCorrect} correct answers` : "take a quiz to see this"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border bg-card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold">Recent aptitude accuracy</h2>
          {chartData.length === 0 ? (
            <EmptyState
              title="No attempts yet"
              description="Take your first timed aptitude set and your accuracy trend will appear here."
              action={
                <Button asChild>
                  <Link to="/aptitude">Start practising</Link>
                </Button>
              }
            />
          ) : (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis
                    domain={[0, 100]}
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "0.75rem",
                      color: "var(--color-card-foreground)",
                    }}
                  />
                  <Bar dataKey="accuracy" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-base font-semibold">Roadmap progress</h2>
          <div className="mt-6 space-y-2">
            <Progress value={completionRate} />
            <p className="text-sm text-muted-foreground">
              {completed} of {data.totalProblems} published problems completed
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Button asChild className="w-full">
              <Link to="/roadmap">Continue roadmap</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/daily">
                {data.todayChallenge ? "Today's challenge" : "Daily challenge"}
              </Link>
            </Button>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-base font-semibold">Recent activity</h2>
        {data.progress.length === 0 ? (
          <EmptyState
            title="Nothing tracked yet"
            description="Open the roadmap and mark your first problem as in progress."
            action={
              <Button asChild>
                <Link to="/roadmap">Open roadmap</Link>
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 divide-y">
            {data.progress.slice(0, 8).map((p) => (
              <li key={p.problem_id} className="flex items-center justify-between gap-4 py-3">
                <span className="truncate text-sm">{p.problems?.title ?? "Problem"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.status.replace("_", " ")} ·{" "}
                  {new Date(p.updated_at).toLocaleDateString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          {icon}
        </span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
