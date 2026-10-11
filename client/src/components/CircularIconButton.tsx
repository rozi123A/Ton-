import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Accent = "violet" | "green" | "cyan" | "amber" | "rose";

type CircularIconButtonProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  accent?: Accent;
  badge?: ReactNode;
  title?: string;
  className?: string;
};

const accentStyles: Record<Accent, string> = {
  violet: "border-violet-300/45 bg-violet-400/15 text-violet-100 shadow-[0_3px_12px_rgba(139,92,246,0.18)]",
  green: "border-emerald-300/45 bg-emerald-400/15 text-emerald-100 shadow-[0_3px_12px_rgba(16,185,129,0.16)]",
  cyan: "border-cyan-300/45 bg-cyan-400/15 text-cyan-100 shadow-[0_3px_12px_rgba(6,182,212,0.16)]",
  amber: "border-amber-300/45 bg-amber-400/15 text-amber-100 shadow-[0_3px_12px_rgba(245,158,11,0.16)]",
  rose: "border-rose-300/45 bg-rose-400/15 text-rose-100 shadow-[0_3px_12px_rgba(244,63,94,0.16)]",
};

/** A compact, thumb-friendly icon action with a 60px circular target and a clear caption. */
export default function CircularIconButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  pressed,
  accent = "violet",
  badge,
  title,
  className,
}: CircularIconButtonProps) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1.5 text-center", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "group relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full border backdrop-blur-sm",
          "shadow-[0_2px_9px_rgba(0,0,0,0.2)] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out",
          "hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] hover:shadow-[0_5px_14px_rgba(0,0,0,0.24)]",
          "active:translate-y-0 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-[0_2px_9px_rgba(0,0,0,0.2)]",
          active ? accentStyles[accent] : "border-white/12 bg-white/[0.045] text-slate-200",
        )}
      >
        <span className="flex h-full w-full items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:stroke-[1.8]">
          {icon}
        </span>
        {badge}
      </button>
      <span aria-hidden="true" className="min-h-4 max-w-[84px] text-[11px] font-medium leading-4 text-slate-300/85">
        {label}
      </span>
    </div>
  );
}
