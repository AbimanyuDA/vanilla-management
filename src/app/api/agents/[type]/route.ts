/**
 * Manual Agent Trigger API Route — POST /api/agents/[type]
 *
 * Protected by NextAuth session. Enqueues a BullMQ job for the specified agent.
 * Falls back to creating a placeholder AgentRunLog if Redis is unavailable.
 *
 * Supported types: "market" | "leads" | "compliance"
 *
 * References: design.md section 8, tasks.md Task 17
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRedisConfigured, getRedis } from "@/lib/redis";
import { AgentType, RunStatus } from "@/generated/prisma/enums";
import { Queue } from "bullmq";
import { QUEUE_NAMES, type AgentJobData } from "@/lib/queue-constants";

// ─── Route config ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// Map URL param to AgentType + Queue name
const AGENT_MAP = {
  market: { agentType: AgentType.MARKET_AGENT, queue: QUEUE_NAMES.MARKET },
  leads: { agentType: AgentType.LEAD_AGENT, queue: QUEUE_NAMES.LEAD },
  compliance: { agentType: AgentType.COMPLIANCE_AGENT, queue: QUEUE_NAMES.COMPLIANCE },
} as const;

type AgentParam = keyof typeof AGENT_MAP;

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: { type: string } }
) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate agent type param
  const agentParam = params.type as AgentParam;
  if (!(agentParam in AGENT_MAP)) {
    return NextResponse.json(
      { error: `Unknown agent type: "${agentParam}". Must be one of: market, leads, compliance` },
      { status: 400 }
    );
  }

  const { agentType, queue: queueName } = AGENT_MAP[agentParam];
  const userId = session.user.id;

  // 3. Create AgentRunLog.RUNNING upfront so UI can show "running" immediately
  const runLog = await db.agentRunLog.create({
    data: {
      agentType,
      status: RunStatus.RUNNING,
      startedAt: new Date(),
      metadata: {
        triggeredBy: "manual",
        triggeredByUserId: userId,
        triggeredAt: new Date().toISOString(),
      },
    },
  });

  // 4a. Try to enqueue via BullMQ
  if (isRedisConfigured()) {
    try {
      const queue = new Queue<AgentJobData>(queueName, {
        connection: getRedis(),
      });

      const job = await queue.add(
        `manual-${agentParam}`,
        {
          triggeredBy: "manual",
          triggeredAt: new Date().toISOString(),
          runId: runLog.id, // Worker will update this log on completion
        },
        { jobId: `manual-${agentParam}-${Date.now()}` }
      );

      await queue.close();

      return NextResponse.json({
        success: true,
        runId: runLog.id,
        jobId: job.id,
        message: `${agentType} enqueued successfully`,
        queuedAt: new Date().toISOString(),
      });
    } catch (redisErr) {
      console.error(`[api/agents/${agentParam}] BullMQ enqueue failed:`, (redisErr as Error).message);
      // Fall through to placeholder response
    }
  }

  // 4b. Fallback: Redis not available — return the run log ID
  // The agent will NOT run automatically; this just tracks a manual trigger attempt.
  // The user can check the dashboard for status.
  await db.agentRunLog.update({
    where: { id: runLog.id },
    data: {
      status: RunStatus.FAILED,
      completedAt: new Date(),
      errorMessage: "Redis tidak terkonfigurasi. Set REDIS_URL untuk menggunakan BullMQ job queue.",
    },
  });

  return NextResponse.json(
    {
      success: false,
      runId: runLog.id,
      message: "Redis tidak tersedia. Trigger manual memerlukan konfigurasi Redis (REDIS_URL).",
      hint: "Tambahkan REDIS_URL=redis://localhost:6379 ke file .env Anda.",
    },
    { status: 503 }
  );
}
