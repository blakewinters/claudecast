"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg bg-bg-elevated border border-line px-3 text-ink",
          "placeholder:text-ink-dim",
          "focus-visible:outline-none focus-visible:border-accent",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-lg bg-bg-elevated border border-line p-3 text-ink",
          "placeholder:text-ink-dim",
          "focus-visible:outline-none focus-visible:border-accent",
          "min-h-[120px] resize-y",
          className,
        )}
        {...rest}
      />
    );
  },
);
