"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User as UserIcon } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const user = session?.user;
  if (!user) return null;
  const { email, name, image } = user;
  const initial = (name || email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        className="h-9 w-9 rounded-full bg-bg-elevated overflow-hidden flex items-center justify-center text-sm font-semibold text-ink"
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-60 rounded-lg bg-bg-card border border-line shadow-lg overflow-hidden">
            <div className="px-3 py-3 border-b border-line">
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-ink-muted" />
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">
                    {name ?? "Signed in"}
                  </div>
                  {email && (
                    <div className="truncate text-xs text-ink-dim">{email}</div>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-bg-elevated text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
