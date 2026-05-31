import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { AgentType, RunStatus } from "@/generated/prisma/enums";
import { isRedisConfigured, getRedis } from "@/lib/redis";
import { Queue } from "bullmq";
import { QUEUE_NAMES, type AgentJobData } from "@/lib/queue-constants";

// Map AgentType enum → BullMQ queue name
const AGENT_QUEUE_MAP: Record<AgentType, string> = {
  [AgentType.MARKET_AGENT]: QUEUE_NAMES.MARKET,
  [AgentType.LEAD_AGENT]: QUEUE_NAMES.LEAD,
  [AgentType.COMPLIANCE_AGENT]: QUEUE_NAMES.COMPLIANCE,
};

export const agentsRouter = router({
  // GET agent status for all three agents
  getAgentStatus: protectedProcedure.query(async ({ ctx }) => {
    const agentStatuses = await Promise.all(
      Object.values(AgentType).map(async (agentType) => {
        // Get the most recent run (any status)
        const latest = await ctx.db.agentRunLog.findFirst({
          where: { agentType },
          orderBy: { startedAt: "desc" },
        });

        // Get the most recent successful run separately
        const latestSuccess = await ctx.db.agentRunLog.findFirst({
          where: { agentType, status: RunStatus.SUCCESS },
          orderBy: { startedAt: "desc" },
        });

        return {
          agentType,
          isActive: latest?.status === RunStatus.RUNNING,
          lastRunAt: latest?.startedAt ?? null,
          lastSuccessAt: latestSuccess?.completedAt ?? null,
          lastError:
            latest?.status === RunStatus.FAILED
              ? (latest.errorMessage ?? undefined)
              : undefined,
        };
      })
    );
    return agentStatuses;
  }),

  // GET run log history for a specific agent — Task 17
  getRunHistory: protectedProcedure
    .input(
      z.object({
        agentType: z.nativeEnum(AgentType),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.agentRunLog.findMany({
        where: { agentType: input.agentType },
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  // POST trigger — Task 17: enqueue BullMQ job, fallback if Redis unavailable
  triggerAgent: protectedProcedure
    .input(z.object({ agentType: z.nativeEnum(AgentType) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const queueName = AGENT_QUEUE_MAP[input.agentType];

      // Create AgentRunLog.RUNNING upfront for immediate UI feedback
      const log = await ctx.db.agentRunLog.create({
        data: {
          agentType: input.agentType,
          status: RunStatus.RUNNING,
          startedAt: new Date(),
          metadata: {
            triggeredBy: "manual",
            triggeredByUserId: userId,
            triggeredAt: new Date().toISOString(),
          },
        },
      });

      // Try BullMQ enqueue
      if (isRedisConfigured()) {
        try {
          const queue = new Queue<AgentJobData>(queueName, {
            connection: getRedis(),
          });

          const job = await queue.add(
            `manual-${input.agentType.toLowerCase()}`,
            {
              triggeredBy: "manual",
              triggeredAt: new Date().toISOString(),
              runId: log.id,
            },
            { jobId: `manual-${input.agentType}-${Date.now()}` }
          );

          await queue.close();

          return {
            success: true,
            runId: log.id,
            jobId: job.id,
            message: `${input.agentType} berhasil dijadwalkan`,
          };
        } catch (redisErr) {
          // Redis available but enqueue failed — mark log as failed
          await ctx.db.agentRunLog.update({
            where: { id: log.id },
            data: {
              status: RunStatus.FAILED,
              completedAt: new Date(),
              errorMessage: `BullMQ enqueue failed: ${(redisErr as Error).message}`,
            },
          });

          return {
            success: false,
            runId: log.id,
            message: `Gagal menjadwalkan ${input.agentType}: ${(redisErr as Error).message}`,
          };
        }
      }

      // Redis not configured — mark as failed with helpful message
      await ctx.db.agentRunLog.update({
        where: { id: log.id },
        data: {
          status: RunStatus.FAILED,
          completedAt: new Date(),
          errorMessage: "Redis tidak terkonfigurasi. Tambahkan REDIS_URL ke .env.",
        },
      });

      return {
        success: false,
        runId: log.id,
        message: "Redis tidak tersedia. Set REDIS_URL=redis://localhost:6379 untuk mengaktifkan BullMQ.",
      };
    }),
});
