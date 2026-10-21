import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronDown, ExternalLink, Youtube } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoLibrary } from "@/components/video-library";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type ProgressStatus = Database["public"]["Enums"]["progress_status"];

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({
    meta: [
      { title: "Placement roadmap — PlacementCamp" },
      {
        name: "description",
        content: "Work through modules, topics and problems and track your status and deadlines.",
      },
      { property: "og:title", content: "Placement roadmap — PlacementCamp" },
      {
        property: "og:description",
        content: "Modules, topics, problems, difficulty, tags and deadlines in one tracked plan.",
      },
    ],
  }),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openVideos, setOpenVideos] = useState<Record<string, boolean>>({});
  const toggleVideos = (key: string) =>
    setOpenVideos((prev) => ({ ...prev, [key]: !prev[key] }));

  const roadmapQuery = useQuery({
    queryKey: ["roadmap-tree"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select(
          "id, title, description, order_index, roadmap_id, roadmaps(title), topics(id, title, description, order_index, status, problems(id, title, description, resource_url, leetcode_url, gfg_url, difficulty, tags, order_index, status))",
        )
        .eq("status", "published")
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  const progressQuery = useQuery({
    queryKey: ["my-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_problem_progress")
        .select("problem_id, status, deadline")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const bookmarksQuery = useQuery({
    queryKey: ["bookmarks", "problem", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("entity_id")
        .eq("user_id", user!.id)
        .eq("entity_type", "problem");
      if (error) throw error;
      return new Set((data ?? []).map((b) => b.entity_id));
    },
  });

  const setProgress = useMutation({
    mutationFn: async (input: {
      problemId: string;
      status?: ProgressStatus;
      deadline?: string | null;
    }) => {
      const existing = progressQuery.data?.find((p) => p.problem_id === input.problemId);
      const payload = {
        user_id: user!.id,
        problem_id: input.problemId,
        status: input.status ?? (existing?.status as ProgressStatus) ?? "not_started",
        deadline: input.deadline !== undefined ? input.deadline : (existing?.deadline ?? null),
        completed_at:
          (input.status ?? existing?.status) === "completed" ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from("student_problem_progress")
        .upsert(payload, { onConflict: "user_id,problem_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-progress"] }),
    onError: () => toast.error("Couldn't save. Check your connection and try again."),
  });

  const toggleBookmark = useMutation({
    mutationFn: async (problemId: string) => {
      if (bookmarksQuery.data?.has(problemId)) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user!.id)
          .eq("entity_type", "problem")
          .eq("entity_id", problemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: user!.id, entity_type: "problem", entity_id: problemId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const progressMap = useMemo(() => {
    const map = new Map<string, { status: ProgressStatus; deadline: string | null }>();
    for (const p of progressQuery.data ?? []) {
      map.set(p.problem_id, { status: p.status, deadline: p.deadline });
    }
    return map;
  }, [progressQuery.data]);

  if (roadmapQuery.isLoading) return <LoadingState rows={5} />;
  if (roadmapQuery.isError)
    return <ErrorState error={roadmapQuery.error} onRetry={() => roadmapQuery.refetch()} />;

  const modules = roadmapQuery.data ?? [];
  const allProblems = modules.flatMap((m) =>
    (m.topics ?? [])
      .filter((t) => t.status === "published")
      .flatMap((t) => (t.problems ?? []).filter((p) => p.status === "published")),
  );
  const completedCount = allProblems.filter(
    (p) => progressMap.get(p.id)?.status === "completed",
  ).length;
  const overall = allProblems.length
    ? Math.round((completedCount / allProblems.length) * 100)
    : 0;

  const matches = (p: (typeof allProblems)[number]) => {
    const term = search.trim().toLowerCase();
    if (term && !p.title.toLowerCase().includes(term) && !(p.tags ?? []).some((t) => t.toLowerCase().includes(term)))
      return false;
    if (difficulty !== "all" && p.difficulty !== difficulty) return false;
    if (statusFilter !== "all") {
      const st = progressMap.get(p.id)?.status ?? "not_started";
      if (st !== statusFilter) return false;
    }
    return true;
  };

  if (modules.length === 0) {
    return (
      <div>
        <PageHeader title="Placement roadmap" />
        <EmptyState
          title="The roadmap is being prepared"
          description="No modules have been published yet. Once the PlacementCamp team publishes content, it will show up here."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Placement roadmap"
        description="Mark problems as you go and set deadlines you can keep."
      />

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="text-muted-foreground">
            {completedCount} / {allProblems.length} problems
          </span>
        </div>
        <Progress value={overall} className="mt-3" />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search problems or tags"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search problems"
        />
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger aria-label="Filter by difficulty">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="not_started">Not started</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-5">
        {modules.map((m) => {
          const topics = (m.topics ?? [])
            .filter((t) => t.status === "published")
            .sort((a, b) => a.order_index - b.order_index);
          const visibleTopics = topics
            .map((t) => ({
              ...t,
              problems: (t.problems ?? [])
                .filter((p) => p.status === "published" && matches(p))
                .sort((a, b) => a.order_index - b.order_index),
            }))
            .filter((t) => t.problems.length > 0);

          if (visibleTopics.length === 0) return null;

          return (
            <section key={m.id} className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{m.title}</h2>
                {m.roadmaps?.title ? (
                  <Badge variant="secondary">{m.roadmaps.title}</Badge>
                ) : null}
              </div>
              {m.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              ) : null}

              <Accordion type="multiple" className="mt-4">
                {visibleTopics.map((t) => (
                  <AccordionItem key={t.id} value={t.id}>
                    <AccordionTrigger className="text-left">
                      <span>
                        {t.title}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t.problems.length} problems
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="mb-3 rounded-xl border bg-background p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          onClick={() => toggleVideos(`topic:${t.id}`)}
                          aria-expanded={!!openVideos[`topic:${t.id}`]}
                        >
                          <Youtube className="mr-2 h-4 w-4 text-primary" aria-hidden />
                          Topic videos
                          <ChevronDown
                            className={
                              openVideos[`topic:${t.id}`]
                                ? "ml-1 h-4 w-4 rotate-180 transition-transform"
                                : "ml-1 h-4 w-4 transition-transform"
                            }
                            aria-hidden
                          />
                        </Button>
                        {openVideos[`topic:${t.id}`] ? (
                          <div className="mt-3">
                            <VideoLibrary entityType="topic" entityId={t.id} />
                          </div>
                        ) : null}
                      </div>
                      <ul className="space-y-3">
                        {t.problems.map((p) => {
                          const current = progressMap.get(p.id);
                          return (
                            <li key={p.id} className="rounded-xl border bg-background p-4">
                              <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{p.title}</span>
                                  <Badge
                                    variant={
                                      p.difficulty === "hard"
                                        ? "destructive"
                                        : p.difficulty === "medium"
                                          ? "default"
                                          : "secondary"
                                    }
                                  >
                                    {p.difficulty}
                                  </Badge>
                                  {(p.tags ?? []).map((tag) => (
                                    <Badge key={tag} variant="outline">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                                {p.description ? (
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {p.description}
                                  </p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {[
                                    ...(p.leetcode_url
                                      ? [{ label: "Solve on LeetCode", url: p.leetcode_url }]
                                      : []),
                                    ...(p.gfg_url
                                      ? [{ label: "Solve on GeeksforGeeks", url: p.gfg_url }]
                                      : []),
                                    ...(p.resource_url
                                      ? [{ label: "Open resource", url: p.resource_url }]
                                      : []),
                                  ].map((link) => (
                                    <Button key={link.url} asChild size="sm" variant="outline">
                                      <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                      >
                                        {link.label}
                                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                                      </a>
                                    </Button>
                                  ))}
                                </div>

                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
                                <Select
                                  value={current?.status ?? "not_started"}
                                  onValueChange={(value) =>
                                    setProgress.mutate({
                                      problemId: p.id,
                                      status: value as ProgressStatus,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className="w-[150px]"
                                    aria-label={`Status for ${p.title}`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_started">Not started</SelectItem>
                                    <SelectItem value="in_progress">In progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  className="w-[150px]"
                                  aria-label={`Deadline for ${p.title}`}
                                  value={current?.deadline ?? ""}
                                  onChange={(e) =>
                                    setProgress.mutate({
                                      problemId: p.id,
                                      deadline: e.target.value || null,
                                    })
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    bookmarksQuery.data?.has(p.id)
                                      ? "Remove bookmark"
                                      : "Bookmark problem"
                                  }
                                  onClick={() => toggleBookmark.mutate(p.id)}
                                >
                                  {bookmarksQuery.data?.has(p.id) ? (
                                    <BookmarkCheck className="h-4 w-4 text-primary" />
                                  ) : (
                                    <Bookmark className="h-4 w-4" />
                                  )}
                                 </Button>
                              </div>
                              </div>

                              <div className="mt-3 border-t pt-3">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2"
                                  onClick={() => toggleVideos(`problem:${p.id}`)}
                                  aria-expanded={!!openVideos[`problem:${p.id}`]}
                                >
                                  <Youtube className="mr-2 h-4 w-4 text-primary" aria-hidden />
                                  Video explanations
                                  <ChevronDown
                                    className={
                                      openVideos[`problem:${p.id}`]
                                        ? "ml-1 h-4 w-4 rotate-180 transition-transform"
                                        : "ml-1 h-4 w-4 transition-transform"
                                    }
                                    aria-hidden
                                  />
                                </Button>
                                {openVideos[`problem:${p.id}`] ? (
                                  <div className="mt-3">
                                    <VideoLibrary
                                      entityType="problem"
                                      entityId={p.id}
                                      practiceLinks={[
                                        ...(p.leetcode_url
                                          ? [{ label: "LeetCode", url: p.leetcode_url }]
                                          : []),
                                        ...(p.gfg_url
                                          ? [{ label: "GeeksforGeeks", url: p.gfg_url }]
                                          : []),
                                        ...(p.resource_url
                                          ? [{ label: "Resource", url: p.resource_url }]
                                          : []),
                                      ]}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          );
        })}
      </div>
    </div>
  );
}
