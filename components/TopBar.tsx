"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react";
import { UserMenu } from "./UserMenu";

interface Props {
  title?: string;
  back?: boolean;
  rightSlot?: React.ReactNode;
}

export function TopBar({ title, back, rightSlot }: Props) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line">
      <div className="h-14 px-3 flex items-center gap-2">
        {back ? (
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="h-10 w-10 rounded-full hover:bg-bg-elevated flex items-center justify-center text-ink"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <Link
            href="/"
            className="font-semibold text-lg text-ink px-2"
            aria-label="ClaudeCast home"
          >
            ClaudeCast
          </Link>
        )}
        <div className="flex-1 min-w-0 text-center">
          {title && (
            <div className="font-medium truncate text-ink">{title}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {rightSlot}
          <Link
            href="/settings"
            aria-label="Settings"
            className="h-10 w-10 rounded-full hover:bg-bg-elevated flex items-center justify-center text-ink"
          >
            <SettingsIcon className="h-5 w-5" />
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
