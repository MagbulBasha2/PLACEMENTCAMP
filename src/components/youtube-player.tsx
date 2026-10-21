import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { watchUrl } from "@/lib/youtube";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export type PlaybackUpdate = { positionSeconds: number; durationSeconds: number; ended: boolean };

/**
 * Official YouTube IFrame player, embedded in place. We keep YouTube branding,
 * the title bar and the channel link intact and never proxy or re-host video.
 */
export function YouTubePlayer({
  videoId,
  title,
  startSeconds,
  onProgress,
}: {
  videoId: string;
  title: string;
  startSeconds?: number;
  onProgress?: (update: PlaybackUpdate) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const progressRef = useRef(onProgress);
  const [blocked, setBlocked] = useState(false);

  progressRef.current = onProgress;

  useEffect(() => {
    let cancelled = false;
    let ticker: ReturnType<typeof setInterval> | null = null;
    setBlocked(false);

    const report = (ended: boolean) => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      progressRef.current?.({
        positionSeconds: Math.floor(p.getCurrentTime() || 0),
        durationSeconds: Math.floor(p.getDuration?.() || 0),
        ended,
      });
    };

    void loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          playsinline: 1,
          enablejsapi: 1,
          start: startSeconds && startSeconds > 5 ? startSeconds : 0,
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event: any) => {
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              if (ticker) clearInterval(ticker);
              ticker = setInterval(() => report(false), 15000);
            } else {
              if (ticker) clearInterval(ticker);
              ticker = null;
              report(state === window.YT.PlayerState.ENDED);
            }
          },
          onError: (event: any) => {
            // 101 / 150: the creator does not allow playback outside YouTube.
            if ([2, 5, 100, 101, 150].includes(event.data)) setBlocked(true);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (ticker) clearInterval(ticker);
      try {
        report(false);
        playerRef.current?.destroy?.();
      } catch {
        /* player already gone */
      }
      playerRef.current = null;
    };
  }, [videoId, startSeconds]);

  if (blocked) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted p-6 text-center">
        <p className="text-sm font-medium">This creator does not allow playback outside YouTube.</p>
        <p className="text-xs text-muted-foreground">
          Open it on YouTube to watch — the video stays on the creator&apos;s channel.
        </p>
        <Button asChild>
          <a href={watchUrl(videoId)} target="_blank" rel="noreferrer noopener">
            Watch on YouTube
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
      <div ref={hostRef} className="h-full w-full" title={title} />
    </div>
  );
}
