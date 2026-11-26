import { getAvatar } from "@shared/avatars";
import { cn } from "@/utils/cn";

const sizes = {
  xs: "size-8 text-base",
  sm: "size-10 text-xl",
  md: "size-14 text-3xl",
  lg: "size-20 text-5xl",
  xl: "size-28 text-6xl",
} as const;

export function AvatarBubble({
  avatar,
  size = "md",
  online,
  className,
}: {
  avatar: string;
  size?: keyof typeof sizes;
  /** undefined = don't show a status dot */
  online?: boolean;
  className?: string;
}) {
  const a = getAvatar(avatar);
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center rounded-full", sizes[size], className)}>
      <span
        className="absolute inset-0 rounded-full ring-2 ring-white/15"
        style={{ background: a.color }}
      />
      <span className="relative leading-none" role="img" aria-label={a.label}>
        {a.emoji}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            "absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card",
            online ? "bg-success animate-pulse-ring" : "bg-muted-foreground/60",
          )}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}
