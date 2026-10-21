import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ChevronRight, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { RoadmapImportDialog } from "@/components/roadmap-import";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LabeledField } from "@/components/labeled-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["content_status"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({
    meta: [
      { title: "Roadmap content — PlacementCamp admin" },
      {
        name: "description",
        content: "Create and publish roadmaps, modules, topics and practice problems.",
      },
      { property: "og:title", content: "Roadmap content — PlacementCamp admin" },
      {
        property: "og:description",
        content: "Create and publish roadmaps, modules, topics and practice problems.",
      },
    ],
  }),
  component: ContentPage,
});

type Draft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  status: Status;
  order_index: string;
  resource_url: string;
  leetcode_url: string;
  gfg_url: string;
  difficulty: Difficulty;
  tags: string;
};

const emptyDraft: Draft = {
  title: "",
  slug: "",
  description: "",
  status: "draft",
  order_index: "0",
  resource_url: "",
  leetcode_url: "",
  gfg_url: "",
  difficulty: "easy",
  tags: "",
};

type Level = "roadmap" | "module" | "topic" | "problem";

function ContentPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [roadmapId, setRoadmapId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ level: Level; draft: Draft } | null>(null);
  const [formError, setFormError] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const data = useQuery({
    queryKey: ["admin-content"],
    queryFn: async () => {
      const [roadmaps, modules, topics, problems] = await Promise.all([
        supabase.from("roadmaps").select("*").order("order_index"),
        supabase.from("modules").select("*").order("order_index"),
        supabase.from("topics").select("*").order("order_index"),
        supabase.from("problems").select("*").order("order_index"),
      ]);
      for (const r of [roadmaps, modules, topics, problems]) if (r.error) throw r.error;
      return {
        roadmaps: roadmaps.data ?? [],
        modules: modules.data ?? [],
        topics: topics.data ?? [],
        problems: problems.data ?? [],
      };
    },
  });

  const save = useMutation({
    mutationFn: async ({ level, draft }: { level: Level; draft: Draft }) => {
      const title = draft.title.trim();
      if (title.length < 2) throw new Error("Title must be at least 2 characters.");
      const order_index = Number(draft.order_index) || 0;
      const base = {
        title,
        description: draft.description.trim() || null,
        status: draft.status,
        order_index,
        created_by: user!.id,
      };

      let error = null;
      if (level === "roadmap") {
        const slug =
          draft.slug.trim() ||
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const payload = { ...base, slug };
        error = draft.id
          ? (await supabase.from("roadmaps").update(payload).eq("id", draft.id)).error
          : (await supabase.from("roadmaps").insert(payload)).error;
      } else if (level === "module") {
        const payload = { ...base, roadmap_id: roadmapId! };
        error = draft.id
          ? (await supabase.from("modules").update(payload).eq("id", draft.id)).error
          : (await supabase.from("modules").insert(payload)).error;
      } else if (level === "topic") {
        const payload = { ...base, module_id: moduleId! };
        error = draft.id
          ? (await supabase.from("topics").update(payload).eq("id", draft.id)).error
          : (await supabase.from("topics").insert(payload)).error;
      } else {
        const payload = {
          ...base,
          topic_id: topicId!,
          resource_url: draft.resource_url.trim() || null,
          leetcode_url: draft.leetcode_url.trim() || null,
          gfg_url: draft.gfg_url.trim() || null,
          difficulty: draft.difficulty,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        };
        error = draft.id
          ? (await supabase.from("problems").update(payload).eq("id", draft.id)).error
          : (await supabase.from("problems").insert(payload)).error;
      }
      if (error) throw error;

      await logAdminAction({
        actorId: user!.id,
        action: draft.id ? "update" : "create",
        entityType: level,
        entityId: draft.id ?? null,
        details: { title, status: draft.status },
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't save this."),
  });

  const setStatus = useMutation({
    mutationFn: async ({ level, id, status }: { level: Level; id: string; status: Status }) => {
      const table = (
        { roadmap: "roadmaps", module: "modules", topic: "topics", problem: "problems" } as const
      )[level];
      const { error } = await supabase.from(table).update({ status }).eq("id", id);
      if (error) throw error;
      // Keep a problem's video explanations visible exactly when the problem is.
      if (level === "problem") {
        await supabase
          .from("video_resources")
          .update({ status })
          .eq("entity_type", "problem")
          .eq("entity_id", id);
      }
      await logAdminAction({
        actorId: user!.id,
        action: status,
        entityType: level,
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    },
    onError: () => toast.error("Couldn't change the status."),
  });

  const remove = useMutation({
    mutationFn: async ({ level, id }: { level: Level; id: string }) => {
      const table = (
        { roadmap: "roadmaps", module: "modules", topic: "topics", problem: "problems" } as const
      )[level];
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({ actorId: user!.id, action: "delete", entityType: level, entityId: id });
    },
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    },
    onError: () =>
      toast.error("Couldn't delete this. Remove the items inside it first, then try again."),
  });

  if (data.isLoading) return <LoadingState rows={4} />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => data.refetch()} />;

  if (!data.data) return <LoadingState rows={3} />;
  const d = data.data;
  const modules = d.modules.filter((m) => m.roadmap_id === roadmapId);
  const topics = d.topics.filter((t) => t.module_id === moduleId);
  const problems = d.problems.filter((p) => p.topic_id === topicId);

  const openNew = (level: Level) => {
    setFormError("");
    setEditing({ level, draft: { ...emptyDraft } });
  };

  const openEdit = (level: Level, row: Record<string, unknown>) => {
    setFormError("");
    setEditing({
      level,
      draft: {
        id: row["id"] as string,
        title: (row["title"] as string) ?? "",
        slug: (row["slug"] as string) ?? "",
        description: (row["description"] as string) ?? "",
        status: (row["status"] as Status) ?? "draft",
        order_index: String(row["order_index"] ?? 0),
        resource_url: (row["resource_url"] as string) ?? "",
        leetcode_url: (row["leetcode_url"] as string) ?? "",
        gfg_url: (row["gfg_url"] as string) ?? "",
        difficulty: (row["difficulty"] as Difficulty) ?? "easy",
        tags: Array.isArray(row["tags"]) ? (row["tags"] as string[]).join(", ") : "",
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Roadmap content"
        description="Roadmaps hold modules, modules hold topics, topics hold problems."
        action={
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" aria-hidden />
            Bulk import
          </Button>
        }
      />

      <RoadmapImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="grid gap-4 xl:grid-cols-4">
        <Panel
          title="Roadmaps"
          onAdd={() => openNew("roadmap")}
          empty="Create your first roadmap to begin."
          items={d.roadmaps.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            selected: roadmapId === r.id,
            onSelect: () => {
              setRoadmapId(r.id);
              setModuleId(null);
              setTopicId(null);
            },
            onEdit: () => openEdit("roadmap", r),
            onDelete: () => remove.mutate({ level: "roadmap", id: r.id }),
            onStatus: (s) => setStatus.mutate({ level: "roadmap", id: r.id, status: s }),
          }))}
        />

        <Panel
          title="Modules"
          disabled={!roadmapId}
          disabledHint="Select a roadmap first."
          onAdd={() => openNew("module")}
          empty="No modules in this roadmap yet."
          items={modules.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status,
            selected: moduleId === m.id,
            onSelect: () => {
              setModuleId(m.id);
              setTopicId(null);
            },
            onEdit: () => openEdit("module", m),
            onDelete: () => remove.mutate({ level: "module", id: m.id }),
            onStatus: (s) => setStatus.mutate({ level: "module", id: m.id, status: s }),
          }))}
        />

        <Panel
          title="Topics"
          disabled={!moduleId}
          disabledHint="Select a module first."
          onAdd={() => openNew("topic")}
          empty="No topics in this module yet."
          items={topics.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            selected: topicId === t.id,
            onSelect: () => setTopicId(t.id),
            onEdit: () => openEdit("topic", t),
            onDelete: () => remove.mutate({ level: "topic", id: t.id }),
            onStatus: (s) => setStatus.mutate({ level: "topic", id: t.id, status: s }),
          }))}
        />

        <Panel
          title="Problems"
          disabled={!topicId}
          disabledHint="Select a topic first."
          onAdd={() => openNew("problem")}
          empty="No problems in this topic yet."
          items={problems.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            meta: p.difficulty,
            onEdit: () => openEdit("problem", p),
            onDelete: () => remove.mutate({ level: "problem", id: p.id }),
            onStatus: (s) => setStatus.mutate({ level: "problem", id: p.id, status: s }),
          }))}
        />
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.draft.id ? "Edit" : "New"} {editing?.level}
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4">
              <Row label="Title">
                <Input
                  value={editing.draft.title}
                  onChange={(e) =>
                    setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })
                  }
                />
              </Row>
              {editing.level === "roadmap" ? (
                <Row label="Slug (optional)">
                  <Input
                    value={editing.draft.slug}
                    onChange={(e) =>
                      setEditing({ ...editing, draft: { ...editing.draft, slug: e.target.value } })
                    }
                  />
                </Row>
              ) : null}
              <Row label="Description">
                <Textarea
                  rows={3}
                  value={editing.draft.description}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, description: e.target.value },
                    })
                  }
                />
              </Row>
              {editing.level === "problem" ? (
                <>
                  <Row label="Resource link">
                    <Input
                      placeholder="https://"
                      value={editing.draft.resource_url}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, resource_url: e.target.value },
                        })
                      }
                    />
                  </Row>
                  <Row label="LeetCode link">
                    <Input
                      placeholder="https://leetcode.com/problems/..."
                      value={editing.draft.leetcode_url}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, leetcode_url: e.target.value },
                        })
                      }
                    />
                  </Row>
                  <Row label="GeeksforGeeks link">
                    <Input
                      placeholder="https://www.geeksforgeeks.org/..."
                      value={editing.draft.gfg_url}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, gfg_url: e.target.value },
                        })
                      }
                    />
                  </Row>
                  <Row label="Difficulty">
                    <Select
                      value={editing.draft.difficulty}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, difficulty: v as Difficulty },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="Tags (comma separated)">
                    <Input
                      value={editing.draft.tags}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, tags: e.target.value },
                        })
                      }
                    />
                  </Row>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-4">
                <Row label="Status">
                  <Select
                    value={editing.draft.status}
                    onValueChange={(v) =>
                      setEditing({ ...editing, draft: { ...editing.draft, status: v as Status } })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row label="Order">
                  <Input
                    type="number"
                    value={editing.draft.order_index}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, order_index: e.target.value },
                      })
                    }
                  />
                </Row>
              </div>
              {formError ? (
                <p className="text-sm font-medium text-destructive">{formError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <LabeledField label={label}>{children}</LabeledField>;
}

type PanelItem = {
  id: string;
  title: string;
  status: Status;
  meta?: string;
  selected?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (s: Status) => void;
};

function Panel({
  title,
  items,
  onAdd,
  empty,
  disabled,
  disabledHint,
}: {
  title: string;
  items: PanelItem[];
  onAdd: () => void;
  empty: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button size="icon" variant="ghost" aria-label={`Add ${title}`} disabled={disabled} onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {disabled ? (
        <p className="mt-6 text-sm text-muted-foreground">{disabledHint}</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={cn(
                "rounded-xl border p-3",
                it.selected ? "border-primary bg-accent/40" : "",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={it.onSelect}
              >
                <span className="text-sm font-medium">{it.title}</span>
                {it.onSelect ? (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={it.status === "published" ? "default" : "secondary"}>
                  {it.status}
                </Badge>
                {it.meta ? <Badge variant="outline">{it.meta}</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {it.status !== "published" ? (
                  <Button size="sm" variant="ghost" onClick={() => it.onStatus("published")}>
                    Publish
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => it.onStatus("archived")}>
                    Archive
                  </Button>
                )}
                <Button size="icon" variant="ghost" aria-label="Edit" onClick={it.onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={it.onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
