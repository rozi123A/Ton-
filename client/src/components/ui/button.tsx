import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-950/20 hover:brightness-110",
        destructive: "border border-red-400/35 bg-[#ef4444] text-white shadow-sm shadow-red-950/15 hover:bg-red-600",
        outline: "border border-violet-400/45 bg-violet-500/10 text-violet-800 shadow-sm hover:bg-violet-500/15 dark:text-violet-100",
        secondary: "border border-cyan-400/30 bg-cyan-700 text-white shadow-sm hover:bg-cyan-800",
        ghost: "text-violet-700 hover:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/15",
        link: "text-violet-700 underline-offset-4 hover:underline dark:text-violet-200",
        mic: "border border-blue-200/45 bg-[#3b82f6] text-white shadow-sm shadow-blue-950/15 hover:bg-[#2563eb]",
        camera: "border border-violet-200/45 bg-[#8b5cf6] text-white shadow-sm shadow-violet-950/15 hover:bg-[#7c3aed]",
        audio: "border border-cyan-200/45 bg-[#06b6d4] text-white shadow-sm shadow-cyan-950/15 hover:bg-[#0891b2]",
        chat: "border border-emerald-200/45 bg-[#10b981] text-white shadow-sm shadow-emerald-950/15 hover:bg-[#059669]",
        gift: "border border-amber-300/40 bg-[#f59e0b] text-amber-950 shadow-sm shadow-amber-950/10 hover:bg-[#d97706]",
        background: "border border-orange-200/45 bg-[#f97316] text-white shadow-sm shadow-orange-950/15 hover:bg-[#ea580c]",
        store: "border border-pink-200/45 bg-[#ec4899] text-white shadow-sm shadow-pink-950/15 hover:bg-[#db2777]",
        friends: "border border-rose-200/45 bg-[#ef4444] text-white shadow-sm shadow-rose-950/15 hover:bg-[#dc2626]",
        ai: "border border-blue-300/35 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm shadow-indigo-950/15 hover:brightness-110",
        radar: "border border-violet-300/35 bg-gradient-to-r from-violet-700 to-purple-600 text-white shadow-sm shadow-violet-950/15 hover:brightness-110",
        start: "border border-emerald-300/40 bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-md shadow-emerald-950/20 hover:brightness-110",
        next: "border border-orange-200/45 bg-[#f97316] text-white shadow-sm shadow-orange-950/15 hover:bg-[#ea580c]",
        end: "border border-red-200/45 bg-[#ef4444] text-white shadow-sm shadow-red-950/15 hover:bg-[#dc2626]",
        logout: "border border-red-400/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-200",
        addAccount: "border border-blue-300/35 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm shadow-indigo-950/15 hover:brightness-110",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-10 p-0",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-12 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
