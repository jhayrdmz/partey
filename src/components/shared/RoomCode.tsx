import { cn } from "@/utils/cn";

/** Big, letter-tiled room code. */
export function RoomCode({ code, size = "md", className }: { code: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <div className={cn("flex gap-1.5 sm:gap-2", className)} aria-label={`Room code ${code.split("").join(" ")}`}>
      {code.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "grid place-items-center rounded-xl border-2 border-primary/40 bg-gradient-to-b from-secondary to-card font-extrabold text-white shadow-lg shadow-primary/20",
            size === "sm" && "size-10 text-xl",
            size === "md" && "size-14 text-3xl",
            size === "lg" && "size-20 text-5xl",
            size === "xl" && "size-24 text-6xl 3xl:size-32 3xl:text-8xl",
          )}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
