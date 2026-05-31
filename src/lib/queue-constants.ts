/**
 * BullMQ Queue constants — shared between API routes and workers/scheduler.ts
 *
 * This file is intentionally minimal so it can be imported from both
 * the Next.js app (src/) and the standalone worker process (workers/).
 */

export const QUEUE_NAMES = {
  MARKET: "market-agent",
  LEAD: "lead-agent",
  COMPLIANCE: "compliance-agent",
  FREIGHT: "freight-rates",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface AgentJobData {
  triggeredBy: "cron" | "manual";
  triggeredAt: string; // ISO timestamp
  runId?: string;      // pre-created AgentRunLog.id (for manual triggers)
  options?: {
    skipRegulations?: boolean;
    skipFreightRates?: boolean;
  };
}
