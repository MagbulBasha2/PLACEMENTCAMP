/** Helpers for working with YouTube links. We never download or re-host video. */

/** Extracts the 11-character video id from any common YouTube URL form. */
export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const allowed = ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com"];
  if (!allowed.includes(host)) return null;

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (url.pathname === "/watch") {
    candidate = url.searchParams.get("v");
  } else {
    const m = url.pathname.match(/^\/(embed|shorts|v|live)\/([^/?#]+)/);
    candidate = m?.[2] ?? null;
  }

  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function channelSearchUrl(channel: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(channel)}`;
}

export function thumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Admin-defined tutor preference order. Nothing is auto-labelled "best" —
 * the admin's featured flag always wins, this is only the tie-breaker.
 */
export const TUTOR_PRIORITY = ["striver", "takeuforward", "take u forward", "apna college"];

export function tutorRank(tutor: string, channel: string | null) {
  const hay = `${tutor} ${channel ?? ""}`.toLowerCase();
  if (hay.includes("striver") || hay.includes("takeuforward") || hay.includes("take u forward")) return 0;
  if (hay.includes("apna college")) return 1;
  return 2;
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  concept: "Concept",
  approach: "Approach",
  dry_run: "Dry run",
  solution: "Solution",
  revision: "Revision",
};

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Accepts 720, "12:30", "1:02:03" or "12m 30s" and returns seconds. */
export function parseDuration(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  if (/^(\d+:)?\d{1,2}:\d{1,2}$/.test(value)) {
    const parts = value.split(":").map(Number);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const m = value.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  if (m && (m[1] || m[2] || m[3])) {
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }
  return null;
}

type Rankable = {
  featured: boolean;
  verified: boolean;
  priority: number;
  tutor_name: string;
  channel: string | null;
  created_at?: string;
};

/** Featured first, then admin priority, then the stated tutor order. */
export function compareVideos(a: Rankable, b: Rankable) {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  const ra = tutorRank(a.tutor_name, a.channel);
  const rb = tutorRank(b.tutor_name, b.channel);
  if (ra !== rb) return ra - rb;
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
