import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, InlineSpinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { startTest, submitTest, type QuizReviewItem } from "@/lib/aptitude.functions";

export const Route = createFileRoute("/_authenticated/aptitude/test/$testId")({
  head: () => ({
    meta: [
      { title: "Full timed test — PlacementCamp" },
      { name: "description", content: "Sit a full timed aptitude test and review every answer." },
      { property: "og:title", content: "Full timed test — PlacementCamp" },
      {
        property: "og:description",
        content: "Sit a full timed aptitude test and review every answer.",
      },
    ],
  }),
  component: TestPage,
});

function TestPage() {
  const { testId } = useParams({ from: "/_authenticated/aptitude/test/$testId" });
  const queryClient = useQueryClient();
  const start = useServerFn(startTest);
  const submit = useServerFn(submitTest);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    review: QuizReviewItem[];
  } | null>(null);

  const testQuery = useQuery({
    queryKey: ["aptitude-test", testId],
    queryFn: () => start({ data: { testId } }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const questions = testQuery.data?.questions ?? [];
  const totalSeconds = testQuery.data?.durationSeconds ?? 0;
  const remaining = Math.max(0, totalSeconds - elapsed);

  const submitAttempt = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          testId,
          durationSeconds: Math.min(elapsed, 24 * 3600),
          answers: questions.map((q) => ({
            questionId: q.id,
            selectedIndex: answers[q.id] ?? null,
          })),
        },
      }),
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["aptitude-stats"] });
      queryClient.invalidateQueries({ queryKey: ["aptitude-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Couldn't submit your test. Please try again."),
  });

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt, result]);

  useEffect(() => {
    if (!result && questions.length > 0 && totalSeconds > 0 && remaining === 0 && !submitAttempt.isPending) {
      submitAttempt.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, questions.length, result, totalSeconds]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  if (testQuery.isLoading) return <InlineSpinner label="Preparing your test…" />;
  if (testQuery.isError)
    return <ErrorState error={testQuery.error} onRetry={() => testQuery.refetch()} />;

  if (questions.length === 0) {
    return (
      <div>
        <PageHeader title="Full timed test" />
        <EmptyState
          title="This test has no published questions"
          description="Once questions are published for it, the test becomes available."
          action={
            <Button asChild>
              <Link to="/aptitude">Back to aptitude</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (result) {
    const score = Math.round((result.correct / result.total) * 100);
    return (
      <div>
        <PageHeader
          title="Your result"
          description={`${testQuery.data?.title ?? "Test"} · completed in ${formatTime(elapsed)}`}
          action={
            <Button asChild variant="outline">
              <Link to="/aptitude">Back to aptitude</Link>
            </Button>
          }
        />
        <div className="rounded-2xl border bg-card p-6">
          <p className="font-display text-4xl font-bold">{score}%</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.correct} correct out of {result.total}
          </p>
          <Progress value={score} className="mt-4" />
        </div>

        <h2 className="mt-8 text-lg font-semibold">Answer review</h2>
        <ol className="mt-4 space-y-4">
          {result.review.map((item, index) => {
            const wasCorrect = item.selectedIndex === item.correctIndex;
            return (
              <li key={item.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  {wasCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {index + 1}. {item.question}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {item.options.map((opt, i) => (
                        <li
                          key={i}
                          className={
                            i === item.correctIndex
                              ? "rounded-lg bg-success/10 px-3 py-1.5 font-medium text-foreground"
                              : i === item.selectedIndex
                                ? "rounded-lg bg-destructive/10 px-3 py-1.5 text-foreground"
                                : "px-3 py-1.5 text-muted-foreground"
                          }
                        >
                          {opt}
                          {i === item.correctIndex ? " · correct answer" : ""}
                          {i === item.selectedIndex && i !== item.correctIndex
                            ? " · your answer"
                            : ""}
                        </li>
                      ))}
                    </ul>
                    {item.explanation ? (
                      <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                        {item.explanation}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={testQuery.data?.title ?? "Full timed test"}
        description={`${questions.length} questions · ${Math.round(totalSeconds / 60)} minutes`}
        action={
          <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2 font-medium">
            <Timer className="h-4 w-4 text-primary" aria-hidden />
            <span aria-live="polite">{formatTime(remaining)}</span>
          </div>
        }
      />

      <Progress value={(answeredCount / questions.length) * 100} />
      <p className="mt-2 text-sm text-muted-foreground">
        {answeredCount} of {questions.length} answered
      </p>

      <ol className="mt-6 space-y-4">
        {questions.map((q, index) => (
          <li key={q.id} className="rounded-2xl border bg-card p-5">
            <p className="font-medium">
              {index + 1}. {q.question}
            </p>
            <RadioGroup
              className="mt-4 space-y-2"
              value={answers[q.id] !== undefined ? String(answers[q.id]) : ""}
              onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: Number(v) }))}
            >
              {q.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <RadioGroupItem value={String(i)} id={`${q.id}-${i}`} />
                  <Label htmlFor={`${q.id}-${i}`} className="cursor-pointer font-normal">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-4 mt-6">
        <Button
          size="lg"
          className="w-full"
          disabled={submitAttempt.isPending}
          onClick={() => submitAttempt.mutate()}
        >
          {submitAttempt.isPending ? "Scoring…" : "Submit test"}
        </Button>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
