import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, PlayCircle, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YouTubePlayer } from "@/components/youtube-player";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  RESOURCE_TYPE_LABELS,
  channelSearchUrl,
  compareVideos,
  formatDuration,
  watchUrl,
} from "@/lib/youtube";

type EntityType = "topic" | "problem";

type VideoRow = {
  id: string;
  tutor_name: string;
  channel: string | null;
  video_id: string;
  video_url: string;
  title: string;
  language: string;
  duration_seconds: number | null;
  resource_type: string;
  difficulty: string | null;
  priority: number;
  verified: boolean;
  featured: boolean;
  created_at: string;
};

const lastWatchedKey = (entityType: string, entityId: string) =>
  `pc:last-video:${entityType}:${entityId}`;

export function VideoLibrary({
  entityType,
  entityId,
  practiceLinks,
}: {
  entityType: EntityType;
  entityId: string;
  practiceLinks?: { label: string; url: string }[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tutor, setTutor] = useState("all");
  const [language, setLanguage] = useState("all");
  const [type, setType] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  const videosQuery = useQuery({
    queryKey: ["videos", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_resources")
        .select(
          "id, tutor_name, channel, video_id, video_url, title, language, duration_seconds, resource_type, difficulty, priority, verified, featured, created_at",
        )
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("status", "published");
      if (error) throw error;
      return ((data ?? []) as VideoRow[]).slice().sort(compareVideos);
    },
  });

  const progressQuery = useQuery({
    queryKey: ["video-progress", entityType, entityId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_progress")
        .select("video_resource_id, position_seconds, completed, last_watched_at")
        .eq("user_id", user!.id)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const videos = videosQuery.data ?? [];

  const filtered = useMemo(
    () =>
      videos.filter((v) => {
        if (tutor !== "all" && v.tutor_name !== tutor) return false;
        if (language !== "all" && v.language !== language) return false;
        if (type !== "all" && v.resource_type !== type) return false;
        if (difficulty !== "all" && v.difficulty !== difficulty) return false;
        return true;
      }),
    [videos, tutor, language, type, difficulty],
  );

  // Default to the student's last watched video, otherwise the best available one.
  useEffect(() => {
    if (selectedId && videos.some((v) => v.id === selectedId)) return;
    if (videos.length === 0) return;
    const saved = progressQuery.data ?? [];
    const recent = [...saved].sort((a, b) => b.last_watched_at.localeCompare(a.last_watched_at))[0];
    const local =
      typeof window !== "undefined"
        ? window.localStorage.getItem(lastWatchedKey(entityType, entityId))
        : null;
    const preferred =
      videos.find((v) => v.id === recent?.video_resource_id)?.id ??
      videos.find((v) => v.id === local)?.id ??
      videos[0]!.id;
    setSelectedId(preferred);
  }, [videos, progressQuery.data, selectedId, entityType, entityId]);

  const current = videos.find((v) => v.id === selectedId) ?? filtered[0] ?? videos[0] ?? null;
  const progressFor = (id: string) =>
    (progressQuery.data ?? []).find((p) => p.video_resource_id === id);

  async function saveProgress(update: {
    positionSeconds: number;
    durationSeconds: number;
    ended: boolean;
  }) {
    if (!user || !current) return;
    const completed =
      update.ended ||
      (update.durationSeconds > 0 && update.positionSeconds / update.durationSeconds > 0.9);
    window.localStorage.setItem(lastWatchedKey(entityType, entityId), current.id);
    await supabase.from("video_progress").upsert(
      {
        user_id: user.id,
        video_resource_id: current.id,
        entity_type: entityType,
        entity_id: entityId,
        position_seconds: update.positionSeconds,
        duration_seconds: update.durationSeconds || current.duration_seconds,
        completed,
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,video_resource_id" },
    );
    queryClient.invalidateQueries({ queryKey: ["video-progress", entityType, entityId] });
  }

  if (videosQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading videos…</p>;
  }
  if (videosQuery.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load the videos. Try again.</p>;
  }
  if (videos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No video explanations have been added here yet.
      </p>
    );
  }

  const tutors = [...new Set(videos.map((v) => v.tutor_name))].sort();
  const languages = [...new Set(videos.map((v) => v.language))].sort();
  const types = [...new Set(videos.map((v) => v.resource_type))];
  const difficulties = [...new Set(videos.map((v) => v.difficulty).filter(Boolean))] as string[];
  const others = filtered.filter((v) => v.id !== current?.id);

  return (
    <div className="space-y-4">
      {current ? (
        <div className="space-y-3">
          <YouTubePlayer
            key={current.id}
            videoId={current.video_id}
            title={current.title}
            {...(progressFor(current.id)?.position_seconds
              ? { startSeconds: progressFor(current.id)!.position_seconds }
              : {})}
            onProgress={(u) => void saveProgress(u)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{current.title}</p>
              <p className="text-xs text-muted-foreground">
                {current.tutor_name}
                {current.channel ? (
                  <>
                    {" · "}
                    <a
                      className="hover:underline"
                      href={channelSearchUrl(current.channel)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {current.channel}
                    </a>
                  </>
                ) : null}
                {formatDuration(current.duration_seconds)
                  ? ` · ${formatDuration(current.duration_seconds)}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {current.verified ? (
                <Badge variant="secondary">
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Verified
                </Badge>
              ) : null}
              <Badge variant="outline">
                {RESOURCE_TYPE_LABELS[current.resource_type] ?? current.resource_type}
              </Badge>
              <Button asChild size="sm" variant="ghost">
                <a href={watchUrl(current.video_id)} target="_blank" rel="noreferrer noopener">
                  Watch on YouTube
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {practiceLinks && practiceLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/50 p-3">
          <span className="self-center text-xs font-medium text-muted-foreground">Practice:</span>
          {practiceLinks.map((l) => (
            <Button key={l.url} asChild size="sm" variant="outline">
              <a href={l.url} target="_blank" rel="noreferrer noopener">
                {l.label}
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ))}
        </div>
      ) : null}

      {videos.length > 1 ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Select value={tutor} onValueChange={setTutor}>
              <SelectTrigger aria-label="Filter videos by tutor">
                <SelectValue placeholder="Tutor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tutors</SelectItem>
                {tutors.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger aria-label="Filter videos by language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                {languages.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Filter videos by type">
                <SelectValue placeholder="Video type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All video types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RESOURCE_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger aria-label="Filter videos by difficulty">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulties</SelectItem>
                {difficulties.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h4 className="text-sm font-semibold">More explanations</h4>
            {others.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No other videos match these filters.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {others.map((v) => {
                  const p = progressFor(v.id);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(v.id)}
                        className="flex w-full items-start gap-3 rounded-xl border bg-background p-3 text-left hover:border-primary"
                      >
                        <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{v.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {v.tutor_name} · {v.language} ·{" "}
                            {RESOURCE_TYPE_LABELS[v.resource_type] ?? v.resource_type}
                            {formatDuration(v.duration_seconds)
                              ? ` · ${formatDuration(v.duration_seconds)}`
                              : ""}
                          </span>
                        </span>
                        {p?.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                        ) : p?.position_seconds ? (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(p.position_seconds)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
