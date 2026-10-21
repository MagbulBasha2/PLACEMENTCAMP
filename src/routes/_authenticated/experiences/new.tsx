import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import {
  ExperienceForm,
  emptyExperience,
  toPayload,
  type ExperienceValues,
} from "@/components/experience-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/experiences/new")({
  head: () => ({
    meta: [
      { title: "Share your interview experience — PlacementCamp" },
      {
        name: "description",
        content: "Write up your rounds, questions and outcome for juniors preparing next season.",
      },
      { property: "og:title", content: "Share your interview experience — PlacementCamp" },
      {
        property: "og:description",
        content: "Write up your rounds, questions and outcome for juniors preparing next season.",
      },
    ],
  }),
  component: NewExperience,
});

function NewExperience() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<ExperienceValues>({ ...emptyExperience });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = useMutation({
    mutationFn: async () => {
      const result = toPayload(values);
      if ("errors" in result) {
        setErrors(result.errors);
        throw new Error("validation");
      }
      setErrors({});

      // Duplicate detection: same student, company, role and year.
      const { data: existing } = await supabase
        .from("interview_experiences")
        .select("id")
        .eq("author_id", user!.id)
        .eq("company", result.company)
        .eq("role_title", result.role_title)
        .limit(1);
      if ((existing ?? []).length > 0) {
        setErrors({ form: "You have already submitted an experience for this company and role." });
        throw new Error("validation");
      }

      const { error } = await supabase.from("interview_experiences").insert({
        ...result,
        rounds: result.rounds as never,
        author_id: user!.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submitted for review. It goes live once an admin approves it.");
      navigate({ to: "/experiences" });
    },
    onError: (e) => {
      if ((e as Error).message !== "validation") toast.error("Couldn't submit. Please try again.");
    },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Share your interview experience"
        description="An admin reviews every submission before it appears in the directory."
      />
      <ExperienceForm
        values={values}
        onChange={setValues}
        errors={errors}
        onSubmit={() => submit.mutate()}
        submitting={submit.isPending}
        submitLabel="Submit for review"
      />
    </div>
  );
}
