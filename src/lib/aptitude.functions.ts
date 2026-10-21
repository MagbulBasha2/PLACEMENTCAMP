import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
};

/** Serves a randomised quiz set without exposing the correct answers. */
export const startQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ topicId: z.string().uuid(), count: z.number().int().min(1).max(30) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ questions: QuizQuestion[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("aptitude_questions")
      .select("id, question, options, difficulty")
      .eq("topic_id", data.topicId)
      .eq("status", "published");

    if (error) throw new Error("Could not load questions");

    const shuffled = [...(rows ?? [])].sort(() => Math.random() - 0.5).slice(0, data.count);
    return {
      questions: shuffled.map((q) => ({
        id: q.id,
        question: q.question,
        options: (q.options as string[]) ?? [],
        difficulty: q.difficulty,
      })),
    };
  });

export type QuizReviewItem = {
  id: string;
  question: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  explanation: string | null;
};

/** Grades an attempt server-side and stores the result. */
export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        topicId: z.string().uuid(),
        durationSeconds: z.number().int().min(0).max(24 * 3600),
        answers: z
          .array(
            z.object({
              questionId: z.string().uuid(),
              selectedIndex: z.number().int().min(0).max(5).nullable(),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.answers.map((a) => a.questionId);

    const { data: rows, error } = await supabaseAdmin
      .from("aptitude_questions")
      .select("id, question, options, correct_index, explanation")
      .in("id", ids);
    if (error || !rows) throw new Error("Could not grade this attempt");

    const byId = new Map(rows.map((r) => [r.id, r]));
    let correct = 0;
    const review: QuizReviewItem[] = [];

    for (const answer of data.answers) {
      const row = byId.get(answer.questionId);
      if (!row) continue;
      if (answer.selectedIndex !== null && answer.selectedIndex === row.correct_index) correct += 1;
      review.push({
        id: row.id,
        question: row.question,
        options: (row.options as string[]) ?? [],
        selectedIndex: answer.selectedIndex,
        correctIndex: row.correct_index,
        explanation: row.explanation,
      });
    }

    const { data: attempt, error: insertError } = await supabaseAdmin
      .from("aptitude_attempts")
      .insert({
        user_id: context.userId,
        topic_id: data.topicId,
        total_questions: review.length,
        correct_count: correct,
        duration_seconds: data.durationSeconds,
        answers: review as never,
      })
      .select("id")
      .single();

    if (insertError) throw new Error("Could not save this attempt");

    return { attemptId: attempt.id, correct, total: review.length, review };
  });

/** Today's published challenge, with its question sanitised of the answer. */
export const getDailyChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    const { data: challenge } = await supabaseAdmin
      .from("daily_challenges")
      .select(
        "id, challenge_date, note, aptitude_question_id, problem_id, problems(id, title, description, resource_url, difficulty, tags)",
      )
      .eq("status", "published")
      .lte("challenge_date", today)
      .order("challenge_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!challenge) return { challenge: null };

    let question: QuizQuestion | null = null;
    if (challenge.aptitude_question_id) {
      const { data: q } = await supabaseAdmin
        .from("aptitude_questions")
        .select("id, question, options, difficulty")
        .eq("id", challenge.aptitude_question_id)
        .maybeSingle();
      if (q) {
        question = {
          id: q.id,
          question: q.question,
          options: (q.options as string[]) ?? [],
          difficulty: q.difficulty,
        };
      }
    }

    const { data: attemptRow } = await supabaseAdmin
      .from("daily_challenge_attempts")
      .select("selected_index, is_correct")
      .eq("challenge_id", challenge.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    let attempt: {
      selectedIndex: number;
      correct: boolean;
      correctIndex: number;
      explanation: string | null;
    } | null = null;

    if (attemptRow && challenge.aptitude_question_id) {
      const { data: q } = await supabaseAdmin
        .from("aptitude_questions")
        .select("correct_index, explanation")
        .eq("id", challenge.aptitude_question_id)
        .maybeSingle();
      attempt = {
        selectedIndex: attemptRow.selected_index,
        correct: attemptRow.is_correct,
        correctIndex: q?.correct_index ?? -1,
        explanation: q?.explanation ?? null,
      };
    }

    return {
      challenge: {
        id: challenge.id,
        date: challenge.challenge_date,
        note: challenge.note,
        problem: challenge.problems,
        question,
      },
      attempt,
    };
  });

/** Grades a single daily-challenge answer and records the attempt once per day. */
export const answerDailyQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        questionId: z.string().uuid(),
        selectedIndex: z.number().int().min(0).max(5),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("aptitude_questions")
      .select("correct_index, explanation")
      .eq("id", data.questionId)
      .maybeSingle();
    if (!row) throw new Error("Question not found");

    const correct = row.correct_index === data.selectedIndex;

    await supabaseAdmin.from("daily_challenge_attempts").upsert(
      {
        user_id: context.userId,
        challenge_id: data.challengeId,
        question_id: data.questionId,
        selected_index: data.selectedIndex,
        is_correct: correct,
      },
      { onConflict: "user_id,challenge_id", ignoreDuplicates: true },
    );

    return {
      correct,
      correctIndex: row.correct_index,
      explanation: row.explanation,
    };
  });

/** Loads a published timed test with its questions, answers withheld. */
export const startTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ testId: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      title: string;
      durationSeconds: number;
      questions: QuizQuestion[];
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: test } = await supabaseAdmin
        .from("aptitude_tests")
        .select("id, title, duration_seconds, status")
        .eq("id", data.testId)
        .maybeSingle();
      if (!test || test.status !== "published") throw new Error("This test is not available");

      const { data: links } = await supabaseAdmin
        .from("aptitude_test_questions")
        .select("question_id, order_index, aptitude_questions(id, question, options, difficulty, status)")
        .eq("test_id", data.testId)
        .order("order_index");

      const questions: QuizQuestion[] = [];
      for (const link of links ?? []) {
        const q = link.aptitude_questions as unknown as {
          id: string;
          question: string;
          options: string[];
          difficulty: string;
          status: string;
        } | null;
        if (!q || q.status !== "published") continue;
        questions.push({
          id: q.id,
          question: q.question,
          options: (q.options as string[]) ?? [],
          difficulty: q.difficulty,
        });
      }

      return { title: test.title, durationSeconds: test.duration_seconds, questions };
    },
  );

/** Grades a full test attempt server-side and stores it. */
export const submitTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        testId: z.string().uuid(),
        durationSeconds: z.number().int().min(0).max(24 * 3600),
        answers: z
          .array(
            z.object({
              questionId: z.string().uuid(),
              selectedIndex: z.number().int().min(0).max(9).nullable(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: test } = await supabaseAdmin
      .from("aptitude_tests")
      .select("id, status")
      .eq("id", data.testId)
      .maybeSingle();
    if (!test || test.status !== "published") throw new Error("This test is not available");

    // Only grade questions that actually belong to this published test.
    const { data: links } = await supabaseAdmin
      .from("aptitude_test_questions")
      .select("question_id")
      .eq("test_id", data.testId);
    const allowed = new Set((links ?? []).map((l) => l.question_id));
    const ids = data.answers.map((a) => a.questionId).filter((id) => allowed.has(id));
    if (ids.length === 0) throw new Error("Could not grade this attempt");

    const { data: rows, error } = await supabaseAdmin
      .from("aptitude_questions")
      .select("id, question, options, correct_index, explanation, status")
      .in("id", ids)
      .eq("status", "published");
    if (error || !rows) throw new Error("Could not grade this attempt");

    const byId = new Map(rows.map((r) => [r.id, r]));
    let correct = 0;
    const review: QuizReviewItem[] = [];

    for (const answer of data.answers) {
      const row = byId.get(answer.questionId);
      if (!row) continue;
      if (answer.selectedIndex !== null && answer.selectedIndex === row.correct_index) correct += 1;
      review.push({
        id: row.id,
        question: row.question,
        options: (row.options as string[]) ?? [],
        selectedIndex: answer.selectedIndex,
        correctIndex: row.correct_index,
        explanation: row.explanation,
      });
    }

    const { error: insertError } = await supabaseAdmin.from("aptitude_attempts").insert({
      user_id: context.userId,
      test_id: data.testId,
      total_questions: review.length,
      correct_count: correct,
      duration_seconds: data.durationSeconds,
      answers: review as never,
    });
    if (insertError) throw new Error("Could not save this attempt");

    return { correct, total: review.length, review };
  });
