import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Match every path except:
     * - /api/auth (NextAuth's own endpoints)
     * - /_next/static, /_next/image (Next.js internals)
     * - Anything with a file extension (favicon.ico, images, etc.)
     */
    "/((?!api/auth|_next/static|_next/image|.*\\.).*)",
  ],
};
