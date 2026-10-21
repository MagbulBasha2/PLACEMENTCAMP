/**
 * Server-only sliding-window rate limiter backed by public.rate_limits.
 * Uses the service-role client because the table is not exposed to clients.
 */
export async function enforceRateLimit(options: {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { bucket, identifier, limit, windowSeconds } = options;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("rate_limits")
    .select("id, hits")
    .eq("bucket", bucket)
    .eq("identifier", identifier)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  if (selectError) {
    // Fail open on infrastructure errors rather than blocking legitimate users.
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000),
  );

  if (!existing) {
    await supabaseAdmin.from("rate_limits").insert({
      bucket,
      identifier,
      window_start: windowStart.toISOString(),
      hits: 1,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.hits >= limit) {
    return { allowed: false, retryAfterSeconds };
  }

  await supabaseAdmin
    .from("rate_limits")
    .update({ hits: existing.hits + 1 })
    .eq("id", existing.id);

  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIdentifier(headers: Headers, fallback: string): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("cf-connecting-ip") ?? fallback;
}
