import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — PlacementCamp" },
      { name: "description", content: "Your saved problems and interview experiences." },
      { property: "og:title", content: "Bookmarks — PlacementCamp" },
      { property: "og:description", content: "Your saved problems and interview experiences." },
    ],
  }),
  component: BookmarksPage,
});

function BookmarksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bookmarks-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id, entity_type, entity_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      const problemIds = rows.filter((r) => r.entity_type === "problem").map((r) => r.entity_id);
      const experienceIds = rows
        .filter((r) => r.entity_type === "interview_experience")
        .map((r) => r.entity_id);

      const [problems, experiences] = await Promise.all([
        problemIds.length
          ? supabase.from("problems").select("id, title, difficulty").in("id", problemIds)
          : Promise.resolve({ data: [], error: null }),
        experienceIds.length
          ? supabase
              .from("interview_experiences")
              .select("id, company, role_title")
              .in("id", experienceIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const problemMap = new Map((problems.data ?? []).map((p) => [p.id, p]));
      const expMap = new Map((experiences.data ?? []).map((e) => [e.id, e]));

      return rows.map((r) => ({
        ...r,
        label:
          r.entity_type === "problem"
            ? (problemMap.get(r.entity_id)?.title ?? "Removed problem")
            : r.entity_type === "interview_experience"
              ? `${expMap.get(r.entity_id)?.company ?? "Removed"} — ${expMap.get(r.entity_id)?.role_title ?? ""}`
              : "Saved item",
      }));
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookmarks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks-full"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const items = query.data ?? [];

  return (
    <div>
      <PageHeader title="Bookmarks" description="Everything you saved for revision." />
      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Use the bookmark button on a problem or an interview experience to build your revision list."
          action={
            <Button asChild>
              <Link to="/roadmap">Browse the roadmap</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.label}</p>
                <Badge variant="outline" className="mt-1">
                  {b.entity_type.replace("_", " ")}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove bookmark"
                onClick={() => remove.mutate(b.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
