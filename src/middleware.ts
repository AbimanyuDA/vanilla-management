import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Use the edge-compatible config (no DB, no Node.js-only modules)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
