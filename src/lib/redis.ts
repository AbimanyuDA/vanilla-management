/**
 * Redis Client Singleton — Vanilla Export Intelligence Platform (VEIP)
 *
 * Provides a shared ioredis client instance for BullMQ queues and workers.
 * Uses REDIS_URL env variable (supports redis:// and rediss:// schemes).
 *
 * Pattern: singleton to avoid multiple connections in development (hot-reload).
 *
 * References: design.md section 8, requirements.md Requirement 1 AC4
 */

import Redis from "ioredis";

// ─── Singleton ────────────────────────────────────────────────────────────────

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL environment variable is not set. " +
        "Add REDIS_URL=redis://localhost:6379 to your .env file."
    );
  }

  const client = new Redis(url, {
    // Aggressive retry so BullMQ workers reconnect quickly
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // required by BullMQ
    lazyConnect: false,
  });

  client.on("error", (err: Error) => {
    // Log but don't crash — BullMQ handles reconnection
    console.error("[Redis] Connection error:", err.message);
  });

  client.on("connect", () => {
    console.log("[Redis] Connected to", url.replace(/:[^@]*@/, ":***@"));
  });

  return client;
}

/**
 * Shared Redis client.
 * Call `getRedis()` to obtain the instance; it may throw if REDIS_URL is unset.
 */
export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient();
  }
  return globalForRedis.redis;
}

/**
 * True if Redis is configured via REDIS_URL.
 * Use this to conditionally enable BullMQ features.
 */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}
