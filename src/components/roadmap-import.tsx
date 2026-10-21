import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { LabeledField } from "@/components/labeled-field";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { downloadFile, readRows, toCsv } from "@/lib/csv";
import { extractVideoId, watchUrl } from "@/lib/youtube";
import type { Database } from "@/integrations/supabase/types";

type Difficulty = Database["public"]["Enums"]["difficulty_level"];

const HEADERS = [
  "roadmap_title",
  "module_title",
  "topic_title",
  "problem_title",
  "difficulty",
  "problem_url",
  "video_url",
  "source_attribution",
  "tags",
  "status",
];

const SAMPLE = [
  "DSA Placement Roadmap",
  "Arrays",
  "Two pointers",
  "Move zeroes to the end",
  "easy",
  "https://leetcode.com/problems/move-zeroes/",
  "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  "Your own notes",
  "arrays|two-pointers",
  "draft",
];

type ParsedRow = {
  line: number;
  ok: boolean;
  problem?: string;
  raw: Record<string, string>;
  value?: {
    roadmapTitle: string;
    moduleTitle: string;
    topicTitle: string;
    problemTitle: string;
    difficulty: Difficulty;
    leetcodeUrl: string | null;
    gfgUrl: string | null;
    resourceUrl: string | null;
    videoId: string | null;
    source: string | null;
    tags: string[];
  };
};

type Summary = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { line: number; reason: string; raw: Record<string, string> }[];
};

export function RoadmapImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  function reset() {
    setRows(null);
    setError("");
    setSummary(null);
  }

  async function handleFile(file: File) {
    setError("");
    setRows(null);
    setSummary(null);
    try {
      const raw = await readRows(file);
      if (raw.length === 0) {
        setError("That file has no rows.");
        return;
      }
      const seen = new Set<string>();
      const parsed: ParsedRow[] = raw.map((r, i) => {
        const line = i + 2;
        const roadmapTitle = (r["roadmap_title"] ?? "").trim();
        const moduleTitle = (r["module_title"] ?? "").trim();
        const topicTitle = (r["topic_title"] ?? "").trim();
        const problemTitle = (r["problem_title"] ?? "").trim();

        const missing = [
          !roadmapTitle && "roadmap_title",
          !moduleTitle && "module_title",
          !topicTitle && "topic_title",
          !problemTitle && "problem_title",
        ].filter(Boolean);
        if (missing.length > 0)
          return { line, ok: false, raw: r, problem: `Missing ${missing.join(", ")}` };

        const problemUrl = (r["problem_url"] ?? "").trim();
        if (problemUrl && !/^https?:\/\//i.test(problemUrl))
          return { line, ok: false, raw: r, problem: "problem_url must start with http" };

        const videoUrlRaw = (r["video_url"] ?? "").trim();
        let videoId: string | null = null;
        if (videoUrlRaw) {
          videoId = extractVideoId(videoUrlRaw);
          if (!videoId) return { line, ok: false, raw: r, problem: "video_url is not a YouTube link" };
        }

        const key = `${roadmapTitle}|${moduleTitle}|${topicTitle}|${problemTitle}`.toLowerCase();
        if (seen.has(key))
          return { line, ok: false, raw: r, problem: "Duplicate row in this file" };
        seen.add(key);

        const host = problemUrl.toLowerCase();
        const diff = (r["difficulty"] ?? "").toLowerCase();

        return {
          line,
          ok: true,
          raw: r,
          value: {
            roadmapTitle,
            moduleTitle,
            topicTitle,
            problemTitle,
            difficulty: (["easy", "medium", "hard"].includes(diff) ? diff : "easy") as Difficulty,
            leetcodeUrl: host.includes("leetcode.com") ? problemUrl : null,
            gfgUrl: host.includes("geeksforgeeks.org") ? problemUrl : null,
            resourceUrl:
              problemUrl && !host.includes("leetcode.com") && !host.includes("geeksforgeeks.org")
                ? problemUrl
                : null,
            videoId,
            source: (r["source_attribution"] ?? "").trim() || null,
            tags: (r["tags"] ?? "")
              .split(/[|,]/)
              .map((t) => t.trim())
              .filter(Boolean),
          },
        };
      });
      setRows(parsed);
    } catch (e) {
      setError((e as Error).message || "Couldn't read that file.");
    }
  }

  const runImport = useMutation({
    mutationFn: async (): Promise<Summary> => {
      const valid = (rows ?? []).filter((r) => r.ok && r.value);
      if (valid.length === 0) throw new Error("There are no valid rows to import.");

      const result: Summary = {
        imported: 0,
        updated: 0,
        skipped: (rows ?? []).length - valid.length,
        failed: 0,
        errors: (rows ?? [])
          .filter((r) => !r.ok)
          .map((r) => ({ line: r.line, reason: r.problem ?? "Invalid row", raw: r.raw })),
      };

      const [roadmapRows, moduleRows, topicRows, problemRows] = await Promise.all([
        supabase.from("roadmaps").select("id, title"),
        supabase.from("modules").select("id, title, roadmap_id"),
        supabase.from("topics").select("id, title, module_id"),
        supabase
          .from("problems")
          .select("id, title, topic_id, resource_url, leetcode_url, gfg_url, description, status"),
      ]);

      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const roadmapCache = new Map(
        (roadmapRows.data ?? []).map((r) => [norm(r.title), r.id] as const),
      );
      const moduleCache = new Map<string, string>(
        (moduleRows.data ?? []).map((m) => [`${m.roadmap_id}|${norm(m.title)}`, m.id] as const),
      );
      const topicCache = new Map<string, string>(
        (topicRows.data ?? []).map((t) => [`${t.module_id}|${norm(t.title)}`, t.id] as const),
      );
      type ExistingProblem = NonNullable<(typeof problemRows)["data"]>[number];
      const problemMap = new Map<string, ExistingProblem>(
        (problemRows.data ?? []).map((p) => [`${p.topic_id}|${norm(p.title)}`, p] as const),
      );

      const counters = new Map<string, number>();
      const nextOrder = (key: string) => {
        const n = counters.get(key) ?? 0;
        counters.set(key, n + 1);
        return n;
      };

      for (const row of valid) {
        const v = row.value!;
        try {
          // Roadmap
          let roadmapId = roadmapCache.get(norm(v.roadmapTitle));
          if (!roadmapId) {
            const slug = `${norm(v.roadmapTitle).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
            const { data, error: e } = await supabase
              .from("roadmaps")
              .insert({
                title: v.roadmapTitle,
                slug,
                status: "draft",
                order_index: roadmapCache.size,
                created_by: user!.id,
              })
              .select("id")
              .single();
            if (e || !data) throw new Error(e?.message ?? "Could not create roadmap");
            roadmapId = data.id;
            roadmapCache.set(norm(v.roadmapTitle), roadmapId);
          }

          // Module
          const moduleKey = `${roadmapId}|${norm(v.moduleTitle)}`;
          let moduleId = moduleCache.get(moduleKey);
          if (!moduleId) {
            const { data, error: e } = await supabase
              .from("modules")
              .insert({
                roadmap_id: roadmapId,
                title: v.moduleTitle,
                status: "draft",
                order_index: nextOrder(`m:${roadmapId}`),
                created_by: user!.id,
              })
              .select("id")
              .single();
            if (e || !data) throw new Error(e?.message ?? "Could not create module");
            moduleId = data.id;
            moduleCache.set(moduleKey, moduleId);
          }

          // Topic
          const topicKey = `${moduleId}|${norm(v.topicTitle)}`;
          let topicId = topicCache.get(topicKey);
          if (!topicId) {
            const { data, error: e } = await supabase
              .from("topics")
              .insert({
                module_id: moduleId,
                title: v.topicTitle,
                status: "draft",
                order_index: nextOrder(`t:${moduleId}`),
                created_by: user!.id,
              })
              .select("id")
              .single();
            if (e || !data) throw new Error(e?.message ?? "Could not create topic");
            topicId = data.id;
            topicCache.set(topicKey, topicId);
          }

          // Problem — matched on roadmap › module › topic › title, then updated in place.
          const problemKey = `${topicId}|${norm(v.problemTitle)}`;
          const existing = problemMap.get(problemKey);
          let problemId: string;
          let problemStatus: Database["public"]["Enums"]["content_status"] = "draft";

          if (existing) {
            problemId = existing.id;
            problemStatus = existing.status;
            // Backfill only: never wipe a link that is already stored.
            const patch = {
              resource_url: existing.resource_url ?? v.resourceUrl,
              leetcode_url: existing.leetcode_url ?? v.leetcodeUrl,
              gfg_url: existing.gfg_url ?? v.gfgUrl,
              difficulty: v.difficulty,
              ...(v.tags.length > 0 ? { tags: v.tags } : {}),
              ...(existing.description || !v.source ? {} : { description: `Source: ${v.source}` }),
            };
            const { error: ue } = await supabase
              .from("problems")
              .update(patch)
              .eq("id", problemId);
            if (ue) throw new Error(ue.message);
            problemMap.set(problemKey, { ...existing, ...patch });
            result.updated += 1;
          } else {
            const { data: problem, error: pe } = await supabase
              .from("problems")
              .insert({
                topic_id: topicId,
                title: v.problemTitle,
                description: v.source ? `Source: ${v.source}` : null,
                difficulty: v.difficulty,
                tags: v.tags,
                status: "draft",
                order_index: nextOrder(`p:${topicId}`),
                resource_url: v.resourceUrl,
                leetcode_url: v.leetcodeUrl,
                gfg_url: v.gfgUrl,
                created_by: user!.id,
              })
              .select("id, title, topic_id, resource_url, leetcode_url, gfg_url, description, status")
              .single();
            if (pe || !problem) throw new Error(pe?.message ?? "Could not create problem");
            problemId = problem.id;
            problemStatus = problem.status;
            problemMap.set(problemKey, problem);
            result.imported += 1;
          }

          if (v.videoId) {
            // The video follows the problem's own status so a published problem
            // shows its video, and a draft one stays hidden from students.
            const { data: existingVideo } = await supabase
              .from("video_resources")
              .select("id")
              .eq("entity_type", "problem")
              .eq("entity_id", problemId)
              .eq("video_id", v.videoId)
              .maybeSingle();

            const videoPayload = {
              entity_type: "problem" as const,
              entity_id: problemId,
              tutor_name: v.source || "Unknown tutor",
              video_id: v.videoId,
              video_url: watchUrl(v.videoId),
              title: v.problemTitle,
              language: "English",
              resource_type: "solution" as const,
              status: problemStatus,
              notes: v.source ? `Source: ${v.source}` : null,
            };

            const ve = existingVideo
              ? (await supabase.from("video_resources").update(videoPayload).eq("id", existingVideo.id))
                  .error
              : (
                  await supabase.from("video_resources").insert({
                    ...videoPayload,
                    channel: null,
                    priority: 0,
                    verified: false,
                    featured: false,
                    created_by: user!.id,
                  })
                ).error;

            // A rejected video link must not lose the problem row.
            if (ve)
              result.errors.push({
                line: row.line,
                reason: `Problem saved, video link skipped: ${ve.message}`,
                raw: row.raw,
              });
          }
        } catch (e) {
          result.failed += 1;
          result.errors.push({
            line: row.line,
            reason: (e as Error).message || "Failed to save",
            raw: row.raw,
          });
        }
      }

      await logAdminAction({
        actorId: user!.id,
        action: "bulk_import",
        entityType: "roadmap_hierarchy",
        entityId: null,
        details: {
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
        },
      });

      return result;
    },
    onSuccess: (result) => {
      setSummary(result);
      setRows(null);
      toast.success(
        `${result.imported} new problems added, ${result.updated} existing problems updated`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["roadmap"] });
    },
    onError: (e) => setError((e as Error).message || "Import failed."),
  });

  const validCount = (rows ?? []).filter((r) => r.ok).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import roadmap content</DialogTitle>
          <DialogDescription>
            One row per problem. Missing roadmaps, modules and topics are created for you. New
            problems arrive as drafts — nothing goes live until you publish it. Re-importing the
            same file updates the matching problems and fills in any missing practice or video
            links instead of creating copies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadFile(
                  "placementcamp-roadmap-template.csv",
                  toCsv(HEADERS, [SAMPLE]),
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
                  "placementcamp-roadmap-template.json",
                  JSON.stringify([Object.fromEntries(HEADERS.map((h, i) => [h, SAMPLE[i]]))], null, 2),
                  "application/json",
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              JSON template
            </Button>
          </div>

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

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          {rows ? (
            <div className="rounded-xl border">
              <div className="border-b px-4 py-2 text-sm font-medium">
                {validCount} valid · {rows.length - validCount} will be skipped
              </div>
              <ul className="max-h-64 divide-y overflow-y-auto text-sm">
                {rows.map((r) => (
                  <li key={r.line} className="flex items-start gap-3 px-4 py-2">
                    <span className="w-12 shrink-0 text-xs text-muted-foreground">row {r.line}</span>
                    {r.ok ? (
                      <span className="min-w-0">
                        <span className="block truncate">{r.value!.problemTitle}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.value!.roadmapTitle} › {r.value!.moduleTitle} › {r.value!.topicTitle} ·{" "}
                          {r.value!.difficulty}
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

          {summary ? (
            <div className="space-y-3 rounded-xl border p-4 text-sm">
              <p className="font-medium">Import finished</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>Imported: {summary.imported}</li>
                <li>Updated (existing problems backfilled): {summary.updated}</li>
                <li>Skipped (invalid): {summary.skipped}</li>
                <li>Failed: {summary.failed}</li>
              </ul>
              {summary.errors.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadFile(
                      "placementcamp-roadmap-import-errors.csv",
                      toCsv(
                        ["row", "reason", ...HEADERS],
                        summary.errors.map((e) => [
                          String(e.line),
                          e.reason,
                          ...HEADERS.map((h) => e.raw[h] ?? ""),
                        ]),
                      ),
                      "text/csv",
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Download error report ({summary.errors.length})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={runImport.isPending || validCount === 0}
            onClick={() => runImport.mutate()}
          >
            {runImport.isPending ? "Importing…" : `Import ${validCount} rows as drafts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
