/**
 * BullMQ Scheduler & Worker — Vanilla Export Intelligence Platform (VEIP)
 *
 * Defines BullMQ Queues and Workers for all three AI Agents.
 *
 * Cron schedules (Task 17 requirements):
 *   - market-agent:     every 24 hours  (Requirement 1 AC4)
 *   - lead-agent:       every 72 hours  (Requirement 3 AC2)
 *   - compliance-agent: every 7 days    (Requirement 5 AC3)
 *   - freight-rates:    every 24 hours  (Requirement 6.4) — uses compliance-agent
 *
 * Usage:
 *   Run this file as a standalone Node.js process (the "worker process"):
 *   ```
 *   npx tsx workers/scheduler.ts
 *   ```
 *   Or use the `npm run workers` script.
 *
 * References: design.md section 8, requirements.md Req 1 AC4, 2, 3 AC2, 5 AC3
 */

import "dotenv/config";
import { Queue, Worker, type Job } from "bullmq";
import { getRedis } from "../src/lib/redis.js";
import { AgentType } from "../src/generated/prisma/enums.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { QUEUE_NAMES, type QueueName, type AgentJobData } from "../src/lib/queue-constants.js";

// Worker process uses its own Prisma client (not the Next.js singleton)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

// Re-export RunStatus values as plain strings to avoid enum namespace issues
const STATUS_RUNNING = "RUNNING" as const;
const STATUS_SUCCESS = "SUCCESS" as const;
const STATUS_FAILED = "FAILED" as const;

// ─── Re-export for backward compat (API route used to import from here) ────────

export { QUEUE_NAMES, type QueueName, type AgentJobData } from "../src/lib/queue-constants.js";


// ─── Queue factory ────────────────────────────────────────────────────────────

/**
 * Create (or reconnect to) a BullMQ Queue.
 * Queues are lightweight — safe to create per-request in API routes.
 */
export function createQueue(name: QueueName): Queue<AgentJobData> {
  return new Queue<AgentJobData>(name, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 }, // 1 min, 2 min, 4 min
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
    },
  });
}

// ─── Cron job definitions ─────────────────────────────────────────────────────

/** Schedule Market_Agent to run every 24 hours (Requirement 1 AC4). */
async function scheduleMarketAgent(queue: Queue<AgentJobData>) {
  await queue.upsertJobScheduler(
    "market-agent-daily",
    { every: 24 * 60 * 60 * 1000 }, // 24h in ms
    {
      name: "cron-market-agent",
      data: { triggeredBy: "cron", triggeredAt: new Date().toISOString() },
    }
  );
  console.log("[scheduler] Market_Agent cron: every 24h ✓");
}

/** Schedule Lead_Agent to run every 72 hours (Requirement 3 AC2). */
async function scheduleLeadAgent(queue: Queue<AgentJobData>) {
  await queue.upsertJobScheduler(
    "lead-agent-72h",
    { every: 72 * 60 * 60 * 1000 }, // 72h in ms
    {
      name: "cron-lead-agent",
      data: { triggeredBy: "cron", triggeredAt: new Date().toISOString() },
    }
  );
  console.log("[scheduler] Lead_Agent cron: every 72h ✓");
}

/** Schedule Compliance_Agent (regulation scraping) every 7 days (Requirement 5 AC3). */
async function scheduleComplianceAgent(queue: Queue<AgentJobData>) {
  await queue.upsertJobScheduler(
    "compliance-agent-7d",
    { every: 7 * 24 * 60 * 60 * 1000 }, // 7d in ms
    {
      name: "cron-compliance-regulations",
      data: {
        triggeredBy: "cron",
        triggeredAt: new Date().toISOString(),
        options: { skipFreightRates: true },
      },
    }
  );
  console.log("[scheduler] Compliance_Agent (regulations) cron: every 7d ✓");
}

/** Schedule freight rate update every 24 hours (Requirement 6.4). */
async function scheduleFreightRates(queue: Queue<AgentJobData>) {
  await queue.upsertJobScheduler(
    "freight-rates-daily",
    { every: 24 * 60 * 60 * 1000 }, // 24h in ms
    {
      name: "cron-freight-rates",
      data: {
        triggeredBy: "cron",
        triggeredAt: new Date().toISOString(),
        options: { skipRegulations: true },
      },
    }
  );
  console.log("[scheduler] Freight rates cron: every 24h ✓");
}

// ─── Worker handlers ──────────────────────────────────────────────────────────

/** Update AgentRunLog status on completion or failure. */
async function updateRunLog(
  runId: string | undefined,
  _agentType: AgentType,
  status: "SUCCESS" | "FAILED",
  errorMessage?: string,
  metadata?: Record<string, unknown>
) {
  if (!runId) return;
  try {
    await db.agentRunLog.update({
      where: { id: runId },
      data: {
        status,
        completedAt: new Date(),
        errorMessage: errorMessage ?? null,
        // Cast metadata to Prisma's InputJsonValue
        ...(metadata !== undefined && { metadata: metadata as object }),
      },
    });
  } catch (err) {
    console.error(`[scheduler] Failed to update AgentRunLog ${runId}:`, (err as Error).message);
  }
}

/** Create an AgentRunLog.RUNNING entry and return its id. */
async function createRunLog(
  agentType: AgentType,
  jobData: AgentJobData
): Promise<string> {
  // If the API trigger already pre-created a log, reuse it
  if (jobData.runId) return jobData.runId;

  const log = await db.agentRunLog.create({
    data: {
      agentType,
      status: STATUS_RUNNING,
      startedAt: new Date(),
      metadata: {
        triggeredBy: jobData.triggeredBy,
        triggeredAt: jobData.triggeredAt,
      } as object,
    },
  });
  return log.id;
}

/** Worker for market-agent queue */
function createMarketWorker(): Worker<AgentJobData> {
  return new Worker<AgentJobData>(
    QUEUE_NAMES.MARKET,
    async (job: Job<AgentJobData>) => {
      console.log(`[market-agent] Job ${job.id} started (${job.data.triggeredBy})`);
      const runId = await createRunLog(AgentType.MARKET_AGENT, job.data);

      try {
        // Dynamically import to avoid loading at startup (heavy LangChain deps)
        const { runMarketAgent } = await import(
          "../ai-agents/market-agent/index.js"
        );
        const result = await runMarketAgent();

        await updateRunLog(runId, AgentType.MARKET_AGENT, STATUS_SUCCESS, undefined, {
          triggeredBy: job.data.triggeredBy,
          ...(result as Record<string, unknown>),
        });

        console.log(`[market-agent] Job ${job.id} completed successfully`);
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`[market-agent] Job ${job.id} failed:`, errorMessage);
        await updateRunLog(runId, AgentType.MARKET_AGENT, STATUS_FAILED, errorMessage);
        throw err; // Re-throw so BullMQ can retry
      }
    },
    {
      connection: getRedis(),
      concurrency: 1, // Only one market scan at a time
    }
  );
}

/** Worker for lead-agent queue */
function createLeadWorker(): Worker<AgentJobData> {
  return new Worker<AgentJobData>(
    QUEUE_NAMES.LEAD,
    async (job: Job<AgentJobData>) => {
      console.log(`[lead-agent] Job ${job.id} started (${job.data.triggeredBy})`);
      const runId = await createRunLog(AgentType.LEAD_AGENT, job.data);

      try {
        const { runLeadAgent } = await import(
          "../ai-agents/lead-agent/index.js"
        );
        const result = await runLeadAgent();

        await updateRunLog(runId, AgentType.LEAD_AGENT, STATUS_SUCCESS, undefined, {
          triggeredBy: job.data.triggeredBy,
          ...(result as Record<string, unknown>),
        });

        console.log(`[lead-agent] Job ${job.id} completed successfully`);
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`[lead-agent] Job ${job.id} failed:`, errorMessage);
        await updateRunLog(runId, AgentType.LEAD_AGENT, STATUS_FAILED, errorMessage);
        throw err;
      }
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  );
}

/** Worker for compliance-agent and freight-rates queues */
function createComplianceWorker(): Worker<AgentJobData> {
  return new Worker<AgentJobData>(
    QUEUE_NAMES.COMPLIANCE,
    async (job: Job<AgentJobData>) => {
      console.log(`[compliance-agent] Job ${job.id} started (${job.data.triggeredBy})`);
      const runId = await createRunLog(AgentType.COMPLIANCE_AGENT, job.data);

      try {
        const { runComplianceAgent } = await import(
          "../ai-agents/compliance-agent/index.js"
        );
        const result = await runComplianceAgent(job.data.options ?? {});

        await updateRunLog(runId, AgentType.COMPLIANCE_AGENT, STATUS_SUCCESS, undefined, {
          triggeredBy: job.data.triggeredBy,
          ...(result as Record<string, unknown>),
        });

        console.log(`[compliance-agent] Job ${job.id} completed`);
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`[compliance-agent] Job ${job.id} failed:`, errorMessage);
        await updateRunLog(runId, AgentType.COMPLIANCE_AGENT, STATUS_FAILED, errorMessage);
        throw err;
      }
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  );
}

/** Worker for freight-rates queue (wraps compliance-agent with skipRegulations: true) */
function createFreightWorker(): Worker<AgentJobData> {
  return new Worker<AgentJobData>(
    QUEUE_NAMES.FREIGHT,
    async (job: Job<AgentJobData>) => {
      console.log(`[freight-rates] Job ${job.id} started (${job.data.triggeredBy})`);
      const runId = await createRunLog(AgentType.COMPLIANCE_AGENT, job.data);

      try {
        const { runComplianceAgent } = await import(
          "../ai-agents/compliance-agent/index.js"
        );
        const result = await runComplianceAgent({ skipRegulations: true });

        await updateRunLog(runId, AgentType.COMPLIANCE_AGENT, STATUS_SUCCESS, undefined, {
          triggeredBy: job.data.triggeredBy,
          freightOnly: true,
          ...(result as Record<string, unknown>),
        });

        console.log(`[freight-rates] Job ${job.id} completed`);
        return result;
      } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`[freight-rates] Job ${job.id} failed:`, errorMessage);
        await updateRunLog(runId, AgentType.COMPLIANCE_AGENT, STATUS_FAILED, errorMessage);
        throw err;
      }
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  );
}

// ─── Main — start all queues and workers ─────────────────────────────────────

async function main() {
  console.log("[scheduler] Starting VEIP BullMQ Scheduler...");

  // Create queues
  const marketQueue = createQueue(QUEUE_NAMES.MARKET);
  const leadQueue = createQueue(QUEUE_NAMES.LEAD);
  const complianceQueue = createQueue(QUEUE_NAMES.COMPLIANCE);
  const freightQueue = createQueue(QUEUE_NAMES.FREIGHT);

  // Register cron schedules
  await scheduleMarketAgent(marketQueue);
  await scheduleLeadAgent(leadQueue);
  await scheduleComplianceAgent(complianceQueue);
  await scheduleFreightRates(freightQueue);

  // Start workers
  const workers = [
    createMarketWorker(),
    createLeadWorker(),
    createComplianceWorker(),
    createFreightWorker(),
  ];

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[scheduler] ${signal} received. Shutting down gracefully...`);
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all([
      marketQueue.close(),
      leadQueue.close(),
      complianceQueue.close(),
      freightQueue.close(),
    ]);
    await db.$disconnect();
    console.log("[scheduler] All workers stopped. Goodbye.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  workers.forEach((w) => {
    w.on("completed", (job) => {
      console.log(`[scheduler] ✓ Job completed: ${w.name}/${job?.id}`);
    });
    w.on("failed", (job, err) => {
      console.error(
        `[scheduler] ✗ Job failed: ${w.name}/${job?.id} — ${err.message}`
      );
    });
  });

  console.log("[scheduler] All workers active. Waiting for jobs...");
  console.log("[scheduler] Press Ctrl+C to stop.");
}

// Run if called directly
if (
  process.argv[1]?.includes("scheduler") ||
  process.argv[1]?.includes("workers")
) {
  main().catch((err) => {
    console.error("[scheduler] Fatal error:", err);
    process.exit(1);
  });
}

export { main as startScheduler };
