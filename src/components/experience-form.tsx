import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Outcome = Database["public"]["Enums"]["interview_outcome"];

export type ExperienceValues = {
  company: string;
  role_title: string;
  college: string;
  year: string;
  interview_date: string;
  questions: string;
  tips: string;
  outcome: Outcome;
  is_anonymous: boolean;
  rounds: { name: string; detail: string }[];
};

export const emptyExperience: ExperienceValues = {
  company: "",
  role_title: "",
  college: "",
  year: "",
  interview_date: "",
  questions: "",
  tips: "",
  outcome: "in_process",
  is_anonymous: false,
  rounds: [{ name: "", detail: "" }],
};

const schema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  role_title: z.string().trim().min(1, "Role is required").max(120),
  college: z.string().trim().max(150),
  year: z
    .string()
    .trim()
    .refine((v) => !v || (/^\d{4}$/.test(v) && +v >= 1990 && +v <= 2100), "Enter a valid year"),
  interview_date: z
    .string()
    .trim()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  questions: z.string().trim().max(5000),
  tips: z.string().trim().max(3000),
});

export type ExperiencePayload = {
  company: string;
  role_title: string;
  college: string | null;
  year: number | null;
  interview_date: string | null;
  rounds: { name: string; detail: string }[];
  questions: string | null;
  tips: string | null;
  outcome: Outcome;
  is_anonymous: boolean;
};

export function toPayload(values: ExperienceValues): ExperiencePayload | { errors: Record<string, string> } {
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  return {
    company: parsed.data.company,
    role_title: parsed.data.role_title,
    college: parsed.data.college || null,
    year: parsed.data.year ? Number(parsed.data.year) : null,
    interview_date: parsed.data.interview_date || null,
    rounds: values.rounds
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim().slice(0, 120), detail: r.detail.trim().slice(0, 2000) })),
    questions: parsed.data.questions || null,
    tips: parsed.data.tips || null,
    outcome: values.outcome,
    is_anonymous: values.is_anonymous,
  };
}

export function ExperienceForm({
  values,
  onChange,
  errors,
  onSubmit,
  submitting,
  submitLabel,
  extra,
  showAnonymous = true,
}: {
  values: ExperienceValues;
  onChange: (values: ExperienceValues) => void;
  errors: Record<string, string>;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  extra?: React.ReactNode;
  showAnonymous?: boolean;
}) {
  const set = <K extends keyof ExperienceValues>(key: K, value: ExperienceValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="company"
          label="Company"
          value={values.company}
          onChange={(v) => set("company", v)}
          error={errors["company"]}
        />
        <Field
          id="role_title"
          label="Role"
          value={values.role_title}
          onChange={(v) => set("role_title", v)}
          error={errors["role_title"]}
        />
        <Field
          id="college"
          label="College"
          value={values.college}
          onChange={(v) => set("college", v)}
          error={errors["college"]}
        />
        <Field
          id="year"
          label="Graduation year"
          value={values.year}
          onChange={(v) => set("year", v)}
          error={errors["year"]}
        />
        <Field
          id="interview_date"
          label="Interview date"
          type="date"
          value={values.interview_date}
          onChange={(v) => set("interview_date", v)}
          error={errors["interview_date"]}
        />
        <div className="space-y-1.5">
          <Label>Outcome</Label>
          <Select value={values.outcome} onValueChange={(v) => set("outcome", v as Outcome)}>
            <SelectTrigger aria-label="Outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">Selected</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="in_process">Still in process</SelectItem>
              <SelectItem value="withdrawn">Withdrew</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Rounds</Label>
        <div className="mt-2 space-y-3">
          {values.rounds.map((r, i) => (
            <div key={i} className="rounded-xl border p-3">
              <div className="flex gap-2">
                <Input
                  placeholder={`Round ${i + 1} name (e.g. Online assessment)`}
                  value={r.name}
                  onChange={(e) =>
                    set(
                      "rounds",
                      values.rounds.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  aria-label={`Round ${i + 1} name`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove round ${i + 1}`}
                  onClick={() =>
                    set(
                      "rounds",
                      values.rounds.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                placeholder="What happened in this round?"
                value={r.detail}
                onChange={(e) =>
                  set(
                    "rounds",
                    values.rounds.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)),
                  )
                }
                aria-label={`Round ${i + 1} details`}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set("rounds", [...values.rounds, { name: "", detail: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add round
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="questions">Questions you were asked</Label>
        <Textarea
          id="questions"
          rows={5}
          value={values.questions}
          onChange={(e) => set("questions", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tips">Preparation tips</Label>
        <Textarea
          id="tips"
          rows={4}
          value={values.tips}
          onChange={(e) => set("tips", e.target.value)}
        />
      </div>

      {showAnonymous ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.is_anonymous}
            onChange={(e) => set("is_anonymous", e.target.checked)}
          />
          Post anonymously — your name is hidden from other students
        </label>
      ) : null}

      {errors["form"] ? (
        <p className="text-sm font-medium text-destructive">{errors["form"]}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {extra}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
