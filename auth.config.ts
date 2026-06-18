import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config used by middleware.
 * Heavy stuff (Google provider, refresh logic) lives in auth.ts.
 */
export default {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isOnLogin = path === "/login";
      const isAuthApi = path.startsWith("/api/auth");
      if (isAuthApi) return true;
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
