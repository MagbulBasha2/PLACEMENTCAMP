import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/states";
import { LabeledField } from "@/components/labeled-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { downloadFile, readRows, toCsv } from "@/lib/csv";
import { extractVideoId, parseDuration, RESOURCE_TYPE_LABELS, watchUrl } from "@/lib/youtube";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["content_status"];
type ResourceType = Database["public"]["Enums"]["video_resource_type"];
type EntityType = Database["public"]["Enums"]["video_entity"];
type Difficulty = Database["public"]["Enums"]["difficulty_level"];

export const Route = createFileRoute("/_authenticated/admin/videos")({
  head: () => ({
    meta: [
      { title: "Video library — PlacementCamp admin" },
      {
        name: "description",
        content: "Attach YouTube explanations to every topic and problem, and bulk import links.",
      },
      { property: "og:title", content: "Video library — PlacementCamp admin" },
      {
        property: "og:description",
        content: "Attach YouTube explanations to every topic and problem, and bulk import links.",
      },
    ],
  }),
  component: VideoAdmin,
});

type Draft = {
  id?: string;
  tutor_name: string;
  channel: string;
  video_url: string;
  title: string;
  language: string;
  duration: string;
  resource_type: ResourceType;
  difficulty: string;
  priority: string;
  verified: boolean;
  featured: boolean;
  status: Status;
  notes: string;
};

const emptyDraft: Draft = {
  tutor_name: "",
  channel: "",
  video_url: "",
  title: "",
  language: "English",
  duration: "",
  resource_type: "concept",
  difficulty: "none",
  priority: "0",
  verified: false,
  featured: false,
  status: "published",
  notes: "",
};

const IMPORT_HEADERS = [
  "entity_type",
  "entity_title",
  "tutor_name",
  "channel",
  "video_url",
  "title",
  "language",
  "duration",
  "resource_type",
  "difficulty",
  "priority",
  "verified",
  "status",
];

type ParsedImportRow = {
  line: number;
  ok: boolean;
  problem?: string;
  payload?: {
    entity_type: EntityType;
    entity_id: string;
    entity_label: string;
    tutor_name: string;
    channel: string | null;
    video_id: string;
    video_url: string;
    title: string;
    language: string;
    duration_seconds: number | null;
    resource_type: ResourceType;
    difficulty: Difficulty | null;
    priority: number;
    verified: boolean;
    status: Status;
  };
};

function VideoAdmin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState<EntityType>("problem");
  const [entityId, setEntityId] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[] | null>(null);
  const [importStatus, setImportStatus] = useState<Status>("published");
  const [importError, setImportError] = useState("");

  const targets = useQuery({
    queryKey: ["admin-video-targets"],
    queryFn: async () => {
      const [topics, problems] = await Promise.all([
        supabase.from("topics").select("id, title, module_id").order("title"),
        supabase.from("problems").select("id, title, topic_id").order("title"),
      ]);
      if (topics.error) throw topics.error;
      if (problems.error) throw problems.error;
      return { topics: topics.data ?? [], problems: problems.data ?? [] };
    },
  });

  const videos = useQuery({
    queryKey: ["admin-videos", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_resources")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("priority");
      if (error) throw error;
      return data ?? [];
    },
  });

  const options = useMemo(() => {
    const t = targets.data;
    if (!t) return [] as { id: string; label: string }[];
    return entityType === "topic"
      ? t.topics.map((x) => ({ id: x.id, label: x.title }))
      : t.problems.map((x) => ({ id: x.id, label: x.title }));
  }, [targets.data, entityType]);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const videoId = extractVideoId(d.video_url);
      if (!videoId) throw new Error("That is not a valid YouTube link.");
      if (d.tutor_name.trim().length < 2) throw new Error("Add the tutor's name.");
      if (d.title.trim().length < 3) throw new Error("Add the video title.");

      const duplicate = (videos.data ?? []).find((v) => v.video_id === videoId && v.id !== d.id);
      if (duplicate) throw new Error("That video is already attached here.");

      const payload = {
        entity_type: entityType,
        entity_id: entityId,
        tutor_name: d.tutor_name.trim(),
        channel: d.channel.trim() || null,
        video_id: videoId,
        video_url: watchUrl(videoId),
        title: d.title.trim(),
        language: d.language.trim() || "English",
        duration_seconds: parseDuration(d.duration),
        resource_type: d.resource_type,
        difficulty: d.difficulty === "none" ? null : (d.difficulty as Difficulty),
        priority: Number(d.priority) || 0,
        verified: d.verified,
        featured: d.featured,
        status: d.status,
        notes: d.notes.trim() || null,
        created_by: user!.id,
      };

      if (d.featured) {
        await supabase
          .from("video_resources")
          .update({ featured: false })
          .eq("entity_type", entityType)
          .eq("entity_id", entityId);
      }

      const { error } = d.id
        ? await supabase.from("video_resources").update(payload).eq("id", d.id)
        : await supabase.from("video_resources").insert(payload);
      if (error) throw error;

      await logAdminAction({
        actorId: user!.id,
        action: d.id ? "update" : "create",
        entityType: "video_resource",
        entityId: d.id ?? null,
        details: { video_id: videoId, status: d.status },
      });
    },
    onSuccess: () => {
      toast.success("Video saved");
      setDraft(null);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e) => setFormError((e as Error).message || "Couldn't save this video."),
  });

  const patch = useMutation({
    mutationFn: async ({
      id,
      values,
      action,
    }: {
      id: string;
      values: Database["public"]["Tables"]["video_resources"]["Update"];
      action: string;
    }) => {
      const { error } = await supabase.from("video_resources").update(values).eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action,
        entityType: "video_resource",
        entityId: id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: () => toast.error("Couldn't update this video."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_resources").delete().eq("id", id);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "delete",
        entityType: "video_resource",
        entityId: id,
      });
    },
    onSuccess: () => {
      toast.success("Video removed");
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: () => toast.error("Couldn't remove this video."),
  });

  async function handleFile(file: File) {
    setImportError("");
    setImportRows(null);
    try {
      const rows = await readRows(file);
      if (rows.length === 0) {
        setImportError("That file has no rows.");
        return;
      }
      const t = targets.data;
      const existing = await supabase.from("video_resources").select("entity_id, video_id");
      const existingKeys = new Set(
        (existing.data ?? []).map((v) => `${v.entity_id}:${v.video_id}`),
      );
      const seen = new Set<string>();

      const parsed: ParsedImportRow[] = rows.map((row, i) => {
        const line = i + 2;
        const type = (row["entity_type"] || "problem").toLowerCase();
        if (type !== "topic" && type !== "problem")
          return { line, ok: false, problem: "entity_type must be topic or problem" };

        const pool = type === "topic" ? (t?.topics ?? []) : (t?.problems ?? []);
        const label = row["entity_title"] || row["entity_id"] || "";
        const matches = pool.filter(
          (x) => x.id === label || x.title.toLowerCase() === label.toLowerCase(),
        );
        if (matches.length === 0)
          return { line, ok: false, problem: `No ${type} called "${label}"` };
        if (matches.length > 1)
          return { line, ok: false, problem: `More than one ${type} called "${label}"` };

        const videoId = extractVideoId(row["video_url"] ?? "");
        if (!videoId) return { line, ok: false, problem: "Invalid YouTube link" };

        const key = `${matches[0]!.id}:${videoId}`;
        if (existingKeys.has(key))
          return { line, ok: false, problem: "Already attached to this item" };
        if (seen.has(key)) return { line, ok: false, problem: "Duplicate row in this file" };
        seen.add(key);

        const title = (row["title"] ?? "").trim();
        const tutor = (row["tutor_name"] ?? "").trim();
        if (!title || !tutor)
          return { line, ok: false, problem: "tutor_name and title are required" };

        const rt = (row["resource_type"] || "concept").toLowerCase().replace(/[\s-]/g, "_");
        const validTypes = ["concept", "approach", "dry_run", "solution", "revision"];
        if (!validTypes.includes(rt))
          return { line, ok: false, problem: `resource_type must be one of ${validTypes.join(", ")}` };

        const diff = (row["difficulty"] || "").toLowerCase();
        const rowStatus = (row["status"] || "").toLowerCase();

        return {
          line,
          ok: true,
          payload: {
            entity_type: type as EntityType,
            entity_id: matches[0]!.id,
            entity_label: matches[0]!.title,
            tutor_name: tutor,
            channel: (row["channel"] ?? "").trim() || null,
            video_id: videoId,
            video_url: watchUrl(videoId),
            title,
            language: (row["language"] ?? "").trim() || "English",
            duration_seconds: parseDuration(row["duration"] ?? ""),
            resource_type: rt as ResourceType,
            difficulty: ["easy", "medium", "hard"].includes(diff) ? (diff as Difficulty) : null,
            priority: Number(row["priority"] ?? 0) || 0,
            verified: ["true", "yes", "1"].includes((row["verified"] ?? "").toLowerCase()),
            status: (["draft", "published", "archived"].includes(rowStatus)
              ? rowStatus
              : importStatus) as Status,
          },
        };
      });
      setImportRows(parsed);
    } catch (e) {
      setImportError((e as Error).message || "Couldn't read that file.");
    }
  }

  const runImport = useMutation({
    mutationFn: async () => {
      const valid = (importRows ?? []).filter((r) => r.ok && r.payload);
      if (valid.length === 0) throw new Error("There are no valid rows to import.");
      const payloads = valid.map((r) => ({
        ...r.payload!,
        entity_label: undefined,
        created_by: user!.id,
      }));
      for (const p of payloads) delete (p as Record<string, unknown>)["entity_label"];
      const { error } = await supabase
        .from("video_resources")
        .insert(payloads as never[]);
      if (error) throw error;
      await logAdminAction({
        actorId: user!.id,
        action: "bulk_import",
        entityType: "video_resource",
        entityId: null,
        details: { count: payloads.length },
      });
      return payloads.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} videos imported`);
      setImportOpen(false);
      setImportRows(null);
      queryClient.invalidateQueries({ queryKey: ["admin-videos"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (e) => setImportError((e as Error).message || "Import failed."),
  });

  if (targets.isLoading) return <LoadingState rows={3} />;
  if (targets.isError) return <ErrorState error={targets.error} onRetry={() => targets.refetch()} />;

  const rows = videos.data ?? [];

  function move(index: number, direction: -1 | 1) {
    const other = rows[index + direction];
    const self = rows[index];
    if (!other || !self) return;
    patch.mutate({ id: self.id, values: { priority: other.priority }, action: "reorder" });
    patch.mutate({ id: other.id, values: { priority: self.priority }, action: "reorder" });
  }

  return (
    <div>
      <PageHeader
        title="Video library"
        description="Link YouTube explanations to topics and problems. Videos always play from YouTube — nothing is copied or re-hosted."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Bulk import
            </Button>
            <Button
              disabled={!entityId}
              onClick={() => {
                setFormError("");
                setDraft({ ...emptyDraft });
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Add video
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <LabeledField label="Attach to">
          <Select
            value={entityType}
            onValueChange={(v) => {
              setEntityType(v as EntityType);
              setEntityId("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="problem">Problem</SelectItem>
              <SelectItem value="topic">Topic</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label={entityType === "topic" ? "Topic" : "Problem"}>
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger>
              <SelectValue placeholder={`Choose a ${entityType}`} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <SelectItem value="none" disabled>
                  Create roadmap content first
                </SelectItem>
              ) : (
                options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </LabeledField>
      </div>

      <div className="mt-6">
        {!entityId ? (
          <p className="text-sm text-muted-foreground">
            Choose a topic or problem to see its videos.
          </p>
        ) : videos.isLoading ? (
          <LoadingState rows={2} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No videos here yet. Add one, or bulk import a list.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((v, i) => (
              <li key={v.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.tutor_name}
                      {v.channel ? ` · ${v.channel}` : ""} · {v.language} ·{" "}
                      {RESOURCE_TYPE_LABELS[v.resource_type] ?? v.resource_type} · {v.video_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.featured ? <Badge>Featured</Badge> : null}
                    <Badge variant={v.verified ? "secondary" : "outline"}>
                      {v.verified ? "Verified" : "Unverified"}
                    </Badge>
                    <Badge variant={v.status === "published" ? "default" : "secondary"}>
                      {v.status}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${v.title} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${v.title} down`}
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patch.mutate({
                        id: v.id,
                        values: { verified: !v.verified },
                        action: v.verified ? "unverify" : "verify",
                      })
                    }
                  >
                    {v.verified ? "Mark unverified" : "Mark verified"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!v.featured) {
                        await supabase
                          .from("video_resources")
                          .update({ featured: false })
                          .eq("entity_type", entityType)
                          .eq("entity_id", entityId);
                      }
                      patch.mutate({
                        id: v.id,
                        values: { featured: !v.featured },
                        action: "feature",
                      });
                    }}
                  >
                    {v.featured ? "Unfeature" : "Feature"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patch.mutate({
                        id: v.id,
                        values: { status: v.status === "published" ? "archived" : "published" },
                        action: v.status === "published" ? "archive" : "publish",
                      })
                    }
                  >
                    {v.status === "published" ? "Archive" : "Publish"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${v.title}`}
                    onClick={() => {
                      setFormError("");
                      setDraft({
                        id: v.id,
                        tutor_name: v.tutor_name,
                        channel: v.channel ?? "",
                        video_url: v.video_url,
                        title: v.title,
                        language: v.language,
                        duration: v.duration_seconds ? String(v.duration_seconds) : "",
                        resource_type: v.resource_type,
                        difficulty: v.difficulty ?? "none",
                        priority: String(v.priority),
                        verified: v.verified,
                        featured: v.featured,
                        status: v.status,
                        notes: v.notes ?? "",
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${v.title}`}
                    onClick={() => remove.mutate(v.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit video" : "Add video"}</DialogTitle>
            <DialogDescription>
              Paste the YouTube link. Students watch it inside PlacementCamp through YouTube&apos;s
              own player.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <LabeledField label="YouTube link">
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={draft.video_url}
                  onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
                />
              </LabeledField>
              <LabeledField label="Video title">
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </LabeledField>
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledField label="Tutor name">
                  <Input
                    value={draft.tutor_name}
                    onChange={(e) => setDraft({ ...draft, tutor_name: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Source channel">
                  <Input
                    value={draft.channel}
                    onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Language">
                  <Input
                    value={draft.language}
                    onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Duration (mm:ss)">
                  <Input
                    value={draft.duration}
                    onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Resource type">
                  <Select
                    value={draft.resource_type}
                    onValueChange={(v) => setDraft({ ...draft, resource_type: v as ResourceType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledField>
                <LabeledField label="Difficulty">
                  <Select
                    value={draft.difficulty}
                    onValueChange={(v) => setDraft({ ...draft, difficulty: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </LabeledField>
                <LabeledField label="Priority order">
                  <Input
                    type="number"
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  />
                </LabeledField>
                <LabeledField label="Status">
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v as Status })}
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
                </LabeledField>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.verified}
                    onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
                  />
                  Verified
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                  />
                  Featured (shown first)
                </label>
              </div>
              <LabeledField label="Internal notes">
                <Textarea
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </LabeledField>
              {formError ? (
                <p className="text-sm font-medium text-destructive">{formError}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) {
            setImportRows(null);
            setImportError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk import videos</DialogTitle>
            <DialogDescription>
              Upload a CSV or JSON file of your own YouTube links. Rows are checked before anything
              is saved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile(
                    "placementcamp-video-template.csv",
                    toCsv(IMPORT_HEADERS, [
                      [
                        "problem",
                        "Two Sum",
                        "Striver",
                        "takeUforward",
                        "https://www.youtube.com/watch?v=UXDSeD9mN-k",
                        "Two Sum — brute to optimal",
                        "English",
                        "12:30",
                        "solution",
                        "easy",
                        "0",
                        "true",
                        "published",
                      ],
                    ]),
                    "text/csv",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" aria-hidden />
                CSV template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadFile(
                    "placementcamp-video-template.json",
                    JSON.stringify(
                      [
                        {
                          entity_type: "problem",
                          entity_title: "Two Sum",
                          tutor_name: "Striver",
                          channel: "takeUforward",
                          video_url: "https://www.youtube.com/watch?v=UXDSeD9mN-k",
                          title: "Two Sum — brute to optimal",
                          language: "English",
                          duration: "12:30",
                          resource_type: "solution",
                          difficulty: "easy",
                          priority: 0,
                          verified: true,
                          status: "published",
                        },
                      ],
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" aria-hidden />
                JSON template
              </Button>
            </div>

            <LabeledField label="Default status for rows without one">
              <Select value={importStatus} onValueChange={(v) => setImportStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </LabeledField>

            <LabeledField label="Choose a CSV or JSON file">
              <Input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </LabeledField>

            {importError ? (
              <p className="text-sm font-medium text-destructive">{importError}</p>
            ) : null}

            {importRows ? (
              <div className="rounded-xl border">
                <div className="border-b px-4 py-2 text-sm font-medium">
                  {importRows.filter((r) => r.ok).length} valid ·{" "}
                  {importRows.filter((r) => !r.ok).length} skipped
                </div>
                <ul className="max-h-64 divide-y overflow-y-auto text-sm">
                  {importRows.map((r) => (
                    <li key={r.line} className="flex items-start gap-3 px-4 py-2">
                      <span className="w-12 shrink-0 text-xs text-muted-foreground">
                        row {r.line}
                      </span>
                      {r.ok ? (
                        <span className="min-w-0">
                          <span className="block truncate">{r.payload!.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {r.payload!.entity_type}: {r.payload!.entity_label} ·{" "}
                            {r.payload!.tutor_name} · {r.payload!.status}
                          </span>
                        </span>
                      ) : (
                        <span className="text-destructive">{r.problem}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                runImport.isPending || !importRows || importRows.filter((r) => r.ok).length === 0
              }
              onClick={() => runImport.mutate()}
            >
              {runImport.isPending
                ? "Importing…"
                : `Import ${(importRows ?? []).filter((r) => r.ok).length} videos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
