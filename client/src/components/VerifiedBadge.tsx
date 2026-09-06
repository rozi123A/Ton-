import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
}

export default function VerifiedBadge({ className = "", size = 16 }: VerifiedBadgeProps) {
  return (
    <BadgeCheck
      aria-label="حساب موثق"
      className={`shrink-0 text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,0.45)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}