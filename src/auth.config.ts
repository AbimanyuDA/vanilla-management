import type { NextAuthConfig, DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

// Type augmentation — adds role and lastActiveAt to session/JWT
declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      lastActiveAt: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    lastActiveAt: number;
  }
}

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");

      if (isDashboard) {
        if (!isLoggedIn) return false; // redirect to /login via pages.signIn

        // Inactivity check — lastActiveAt is refreshed on every request via jwt callback
        const lastActiveAt = auth.user.lastActiveAt;
        if (lastActiveAt && Date.now() - lastActiveAt > INACTIVITY_MS) {
          const url = new URL("/login", nextUrl);
          url.searchParams.set("reason", "session_expired");
          return Response.redirect(url);
        }

        return true;
      }

      // Redirect authenticated users away from /login
      if (nextUrl.pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard/market", nextUrl));
      }

      return true;
    },

    jwt({ token, user }) {
      if (user) {
        // First sign-in: populate token from user object returned by authorize()
        token.id = user.id as string;
        token.role = user.role;
      }
      // Refresh lastActiveAt on every token refresh to track inactivity
      token.lastActiveAt = Date.now();
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.lastActiveAt = token.lastActiveAt;
      return session;
    },
  },

  session: {
    strategy: "jwt" as const,
    // maxAge is longer than inactivity window so the jwt callback
    // can do the granular 30-min check without token expiry interfering
    maxAge: 8 * 60 * 60, // 8 hours absolute max
    updateAge: 0, // always issue a new token to refresh lastActiveAt
  },

  providers: [], // providers are added in src/lib/auth.ts
} satisfies NextAuthConfig;
