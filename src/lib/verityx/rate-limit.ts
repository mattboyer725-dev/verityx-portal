type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_MUTATIONS = 40;

export function rateLimit(userId: string, action: string): void {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
  if (current.count > MAX_MUTATIONS) {
    throw new Error("Too many requests. Wait a moment and retry.");
  }
}
