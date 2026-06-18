"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-bg-card border border-line p-4",
        className,
      )}
      {...rest}
    />
  );
}
