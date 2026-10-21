import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import {
  ExperienceForm,
  emptyExperience,
  toPayload,
  type ExperienceValues,
} from "@/components/experience-form";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/experiences/edit/$id")({
  head: () => ({
    meta: [
      { title: "Edit your submission — PlacementCamp" },
      {
        name: "description",
        content: "Update your interview write-up while it is still awaiting review.",
      },
      { property: "og:title", content: "Edit your submission — PlacementCamp" },
      {
        property: "og:description",
        content: "Update your interview write-up while it is still awaiting review.",
      },
    ],
  }),
  component: EditExperience,
});

function EditExperience() {
  const { id } = useParams({ from: "/_authenticated/experiences/edit/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ExperienceValues>({ ...emptyExperience });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const e = query.data;
    if (!e) return;
    setValues({
      company: e.company,
      role_title: e.role_title,
      college: e.college ?? "",
      year: e.year ? String(e.year) : "",
      interview_date: e.interview_date ?? "",
      questions: e.questions ?? "",
      tips: e.tips ?? "",
      outcome: e.outcome,
      is_anonymous: e.is_anonymous,
      rounds:
        ((e.rounds as unknown as { name: string; detail: string }[]) ?? []).length > 0
          ? (e.rounds as unknown as { name: string; detail: string }[])
          : [{ name: "", detail: "" }],
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const result = toPayload(values);
      if ("errors" in result) {
        setErrors(result.errors);
        throw new Error("validation");
      }
      setErrors({});
      const { error } = await supabase
        .from("interview_experiences")
        .update({ ...result, rounds: result.rounds as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission updated");
      queryClient.invalidateQueries({ queryKey: ["experience", id] });
      queryClient.invalidateQueries({ queryKey: ["experiences"] });
      navigate({ to: "/experiences" });
    },
    onError: (e) => {
      if ((e as Error).message !== "validation")
        toast.error("Couldn't save your changes. Please try again.");
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("interview_experiences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission deleted");
      queryClient.invalidateQueries({ queryKey: ["experiences"] });
      navigate({ to: "/experiences" });
    },
    onError: () => toast.error("Couldn't delete this submission."),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const exp = query.data;
  const editable = exp && exp.author_id === user?.id && exp.status === "pending";

  if (!editable) {
    return (
      <EmptyState
        title="This submission can't be edited"
        description="You can only edit your own submissions while they are still awaiting review."
        action={
          <Button asChild>
            <Link to="/experiences">Back to directory</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Edit your submission"
        description="It stays awaiting review until an admin approves it."
      />
      <ExperienceForm
        values={values}
        onChange={setValues}
        errors={errors}
        onSubmit={() => save.mutate()}
        submitting={save.isPending}
        submitLabel="Save changes"
        extra={
          <Button
            type="button"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete submission
          </Button>
        }
      />
    </div>
  );
}
