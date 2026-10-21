import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarCheck, CheckCircle2, ExternalLink, XCircle } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { answerDailyQuestion, getDailyChallenge } from "@/lib/aptitude.functions";

export const Route = createFileRoute("/_authenticated/daily")({
  head: () => ({
    meta: [
      { title: "Daily challenge — PlacementCamp" },
      { name: "description", content: "One curated placement question published every day." },
      { property: "og:title", content: "Daily challenge — PlacementCamp" },
      { property: "og:description", content: "One curated placement question published every day." },
    ],
  }),
  component: DailyPage,
});

function DailyPage() {
  const fetchChallenge = useServerFn(getDailyChallenge);
  const answer = useServerFn(answerDailyQuestion);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["daily-challenge"],
    queryFn: () => fetchChallenge(),
  });

  const check = useMutation({
    mutationFn: (input: { challengeId: string; questionId: string; selectedIndex: number }) =>
      answer({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-challenge"] }),
  });

  if (query.isLoading) return <LoadingState rows={2} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const challenge = query.data?.challenge;
  const saved = query.data?.attempt ?? null;
  const revealed = check.data ?? saved;
  const chosen = selected ?? saved?.selectedIndex ?? null;

  if (!challenge) {
    return (
      <div>
        <PageHeader title="Daily challenge" />
        <EmptyState
          icon={<CalendarCheck className="h-5 w-5" />}
          title="No challenge published yet"
          description="The team publishes one question a day. As soon as today's is live, it will appear here."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Daily challenge"
        description={new Date(challenge.date).toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      {challenge.note ? (
        <p className="mb-6 rounded-xl border bg-accent/40 px-4 py-3 text-sm">{challenge.note}</p>
      ) : null}

      {challenge.problem ? (
        <section className="rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{challenge.problem.title}</h2>
            <Badge variant="secondary">{challenge.problem.difficulty}</Badge>
            {(challenge.problem.tags ?? []).map((t: string) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
          {challenge.problem.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{challenge.problem.description}</p>
          ) : null}
          {challenge.problem.resource_url ? (
            <a
              href={challenge.problem.resource_url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open problem
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
        </section>
      ) : null}

      {challenge.question ? (
        <section className="mt-6 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{challenge.question.question}</p>
            {saved ? <Badge variant="secondary">Completed today</Badge> : null}
          </div>
          <RadioGroup
            className="mt-4 space-y-2"
            value={chosen !== null ? String(chosen) : ""}
            onValueChange={(v) => setSelected(Number(v))}
            disabled={!!revealed}
          >
            {challenge.question.options.map((opt, i) => {
              const isCorrect = revealed && i === revealed.correctIndex;
              const isWrongPick = revealed && i === chosen && !revealed.correct;
              return (
                <div
                  key={i}
                  className={
                    isCorrect
                      ? "flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2"
                      : isWrongPick
                        ? "flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2"
                        : "flex items-center gap-3 rounded-lg border px-3 py-2"
                  }
                >
                  <RadioGroupItem value={String(i)} id={`daily-${i}`} />
                  <Label htmlFor={`daily-${i}`} className="cursor-pointer font-normal">
                    {opt}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {revealed ? (
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                {revealed.correct ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Correct
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" aria-hidden /> Not quite
                  </>
                )}
              </p>
              {revealed.explanation ? (
                <p className="mt-2 text-sm text-muted-foreground">{revealed.explanation}</p>
              ) : null}
            </div>
          ) : (
            <Button
              className="mt-4"
              disabled={selected === null || check.isPending}
              onClick={() =>
                check.mutate({
                  challengeId: challenge.id,
                  questionId: challenge.question!.id,
                  selectedIndex: selected!,
                })
              }
            >
              {check.isPending ? "Checking…" : "Check answer"}
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}
