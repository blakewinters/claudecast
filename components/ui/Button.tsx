"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-bg hover:bg-accent-strong active:bg-accent-strong",
  secondary:
    "bg-bg-elevated text-ink border border-line hover:bg-bg-card",
  ghost:
    "bg-transparent text-ink hover:bg-bg-elevated",
  danger:
    "bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-base rounded-lg",
  lg: "h-12 px-5 text-base rounded-lg",
  icon: "h-10 w-10 rounded-full",
  "icon-lg": "h-16 w-16 rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", size = "md", ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          "disabled:opacity-50 disabled:pointer-events-none select-none",
          "touch-manipulation",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...rest}
      />
    );
  },
);
