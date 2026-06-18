import type { Metadata, Viewport } from "next";
import { auth } from "@/auth";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaudeCast",
  description: "Listen to Claude responses as podcasts.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en" className="dark">
      <body>
        <Providers session={session}>
          <div className="min-h-screen max-w-2xl mx-auto">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
