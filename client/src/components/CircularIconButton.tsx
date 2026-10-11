import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonIntent =
  | "brand"
  | "mic"
  | "camera"
  | "audio"
  | "chat"
  | "gift"
  | "background"
  | "store"
  | "friends"
  | "ai"
  | "radar"
  | "start"
  | "next"
  | "end"
  | "logout"
  | "addAccount"
  | "profile"
  | "info";

type CircularIconButtonProps = {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  intent?: ButtonIntent;
  badge?: ReactNode;
  title?: string;
  className?: string;
};

const intentStyles: Record<ButtonIntent, string> = {
  brand: "border-violet-400/45 bg-violet-500/20 text-white shadow-[0_3px_12px_rgba(139,92,246,0.14)]",
  mic: "border-[#3b82f6]/55 bg-[#3b82f6]/20 text-white shadow-[0_3px_12px_rgba(59,130,246,0.14)]",
  camera: "border-[#8b5cf6]/55 bg-[#8b5cf6]/20 text-white shadow-[0_3px_12px_rgba(139,92,246,0.14)]",
  audio: "border-[#06b6d4]/55 bg-[#06b6d4]/20 text-white shadow-[0_3px_12px_rgba(6,182,212,0.14)]",
  chat: "border-[#10b981]/55 bg-[#10b981]/20 text-white shadow-[0_3px_12px_rgba(16,185,129,0.14)]",
  gift: "border-[#f59e0b]/60 bg-[#f59e0b]/20 text-white shadow-[0_3px_12px_rgba(245,158,11,0.14)]",
  background: "border-[#f97316]/60 bg-[#f97316]/20 text-white shadow-[0_3px_12px_rgba(249,115,22,0.14)]",
  store: "border-[#ec4899]/55 bg-[#ec4899]/20 text-white shadow-[0_3px_12px_rgba(236,72,153,0.14)]",
  friends: "border-[#ef4444]/55 bg-[#ef4444]/20 text-white shadow-[0_3px_12px_rgba(239,68,68,0.14)]",
  ai: "border-blue-300/50 bg-gradient-to-br from-blue-500/30 to-violet-500/30 text-white shadow-[0_3px_14px_rgba(99,102,241,0.17)]",
  radar: "border-violet-300/55 bg-gradient-to-br from-violet-500/30 to-purple-700/30 text-white shadow-[0_3px_14px_rgba(124,58,237,0.16)]",
  start: "border-emerald-300/60 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_4px_15px_rgba(16,185,129,0.2)]",
  next: "border-orange-300/55 bg-[#f97316]/25 text-white shadow-[0_3px_12px_rgba(249,115,22,0.14)]",
  end: "border-red-300/55 bg-[#ef4444]/25 text-white shadow-[0_3px_12px_rgba(239,68,68,0.14)]",
  logout: "border-red-300/45 bg-[#ef4444]/16 text-white shadow-[0_3px_10px_rgba(239,68,68,0.1)]",
  addAccount: "border-blue-300/50 bg-gradient-to-br from-blue-500/30 to-violet-500/30 text-white shadow-[0_3px_12px_rgba(99,102,241,0.14)]",
  profile: "border-violet-300/50 bg-gradient-to-br from-violet-500/25 to-indigo-500/25 text-white shadow-[0_3px_12px_rgba(124,58,237,0.12)]",
  info: "border-cyan-300/50 bg-cyan-500/18 text-white shadow-[0_3px_10px_rgba(6,182,212,0.1)]",
};

/** A 60px thumb-friendly circular action with a function-specific color and caption. */
export default function CircularIconButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  pressed,
  intent = "brand",
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
          "transition-[transform,filter,background-color,border-color,box-shadow] duration-200 ease-out",
          "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_5px_14px_rgba(0,0,0,0.22)]",
          "active:translate-y-0 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
          intentStyles[intent],
          active && "ring-2 ring-white/20 brightness-110",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:brightness-100 disabled:hover:shadow-none",
        )}
      >
        <span className="flex h-full w-full items-center justify-center text-white [&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:stroke-[1.8]">
          {icon}
        </span>
        {badge}
      </button>
      <span aria-hidden="true" className="min-h-4 max-w-[84px] text-[11px] font-medium leading-4 text-white/85">
        {label}
      </span>
    </div>
  );
}
