import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc";
import { AgentType, RunStatus } from "@/generated/prisma/enums";

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

  // GET run log history for a specific agent
  getRunHistory: protectedProcedure
    .input(
      z.object({
        agentType: z.nativeEnum(AgentType),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO Task 17: implement
      return ctx.db.agentRunLog.findMany({
        where: { agentType: input.agentType },
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });
    }),

  // POST /api/agents/:type/trigger — manual run
  triggerAgent: protectedProcedure
    .input(z.object({ agentType: z.nativeEnum(AgentType) }))
    .mutation(async ({ ctx, input }) => {
      // TODO Task 17: enqueue BullMQ job and return job ID
      // For now, create a RUNNING log entry as a placeholder
      const log = await ctx.db.agentRunLog.create({
        data: {
          agentType: input.agentType,
          status: RunStatus.RUNNING,
          startedAt: new Date(),
          metadata: { triggeredBy: ctx.session.user.id, manual: true },
        },
      });
      return { success: true, runId: log.id };
    }),
});
