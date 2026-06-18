import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import authConfig from "./auth.config";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const SCOPES = ["openid", "email", "profile", DRIVE_SCOPE].join(" ");

const ALLOWED_EMAILS = (
  process.env.AUTH_ALLOWED_EMAILS ?? "summers.blake@gmail.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

interface RefreshResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<RefreshResult> {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description ?? data?.error ?? "refresh_failed");
  }
  return data as RefreshResult;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Google({
      authorization: {
        params: {
          scope: SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return ALLOWED_EMAILS.includes(email);
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = (account.expires_at ?? 0) * 1000;
        token.error = undefined;
        return token;
      }

      const expires = (token.accessTokenExpires as number | undefined) ?? 0;
      if (Date.now() < expires - 60_000) {
        return token;
      }

      if (!token.refreshToken) {
        return { ...token, error: "MissingRefreshToken" };
      }

      try {
        const refreshed = await refreshGoogleAccessToken(
          token.refreshToken as string,
        );
        return {
          ...token,
          accessToken: refreshed.access_token,
          accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
          error: undefined,
        };
      } catch (err) {
        return {
          ...token,
          error: "RefreshAccessTokenError",
        };
      }
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    user: { id?: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
