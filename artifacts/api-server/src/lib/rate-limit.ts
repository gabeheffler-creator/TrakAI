import type { RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

/**
 * Per-process burst limiter. Deployments with multiple API processes need a
 * shared limiter at the edge if a global burst limit is required.
 */
export function burstLimit(
  scope: string,
  maxEnv: string,
  windowEnv: string,
  defaults: { max: number; windowMs: number },
  options?: { actorAware?: boolean; code?: string },
): RequestHandler {
  const max = positiveEnv(maxEnv, defaults.max);
  const windowMs = positiveEnv(windowEnv, defaults.windowMs);
  return (req, res, next) => {
    const now = Date.now();
    const actorKey = options?.actorAware
      ? req.actor
        ? req.actor.type === "coach"
          ? `coach:${req.actor.coach.id}`
          : `client:${req.actor.client.id}`
        : req.session?.coachId
          ? `coach:${req.session.coachId}`
          : req.session?.clientId
            ? `client:${req.session.clientId}`
            : req.ip ?? "unknown"
      : req.ip ?? "unknown";
    const key = `${scope}:${actorKey}`;
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        code: options?.code ?? "RATE_LIMITED",
        retryAfterSeconds: retryAfter,
      });
      return;
    }
    next();
  };
}

export const generalBurstLimit = burstLimit(
  "general",
  "RATE_LIMIT_GENERAL_MAX",
  "RATE_LIMIT_GENERAL_WINDOW_MS",
  { max: 120, windowMs: 60_000 },
  { actorAware: true },
);
export const authBurstLimit = burstLimit(
  "auth",
  "RATE_LIMIT_AUTH_MAX",
  "RATE_LIMIT_AUTH_WINDOW_MS",
  { max: 10, windowMs: 60_000 },
  { code: "AUTH_RATE_LIMIT" },
);
export const aiBurstLimit = burstLimit(
  "ai",
  "RATE_LIMIT_AI_MAX",
  "RATE_LIMIT_AI_WINDOW_MS",
  { max: 10, windowMs: 60_000 },
  { actorAware: true, code: "AI_BURST_LIMIT" },
);