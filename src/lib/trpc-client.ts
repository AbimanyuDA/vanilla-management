import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/root";

// Client-side tRPC hooks — use this in Client Components
// Example: const { data } = trpc.market.getCompetitors.useQuery()
export const trpc = createTRPCReact<AppRouter>();
