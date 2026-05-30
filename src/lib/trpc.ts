import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Session } from "next-auth";

export type Context = {
  session: Session | null;
  db: typeof db;
};

export const createContext = async (): Promise<Context> => {
  const session = await auth();
  return { session, db };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

// All dashboard procedures require an active session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Silakan login terlebih dahulu",
    });
  }
  return next({
    ctx: {
      ...ctx,
      // session is now non-null for all downstream procedures
      session: ctx.session,
    },
  });
});
