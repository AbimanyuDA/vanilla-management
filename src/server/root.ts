import { router } from "@/lib/trpc";
import { marketRouter } from "@/server/routers/market";
import { buyersRouter } from "@/server/routers/buyers";
import { complianceRouter } from "@/server/routers/compliance";
import { agentsRouter } from "@/server/routers/agents";

export const appRouter = router({
  market: marketRouter,
  buyers: buyersRouter,
  compliance: complianceRouter,
  agents: agentsRouter,
});

// Export type for client-side type inference — never import this on the client
export type AppRouter = typeof appRouter;
