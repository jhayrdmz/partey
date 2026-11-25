import { cn } from "@/utils/cn";

/** Partey wordmark. The dot over the "y" is a mango-yellow confetti. */
export function Logo({ className, size = "md", tagline = false }: { className?: string; size?: "sm" | "md" | "lg" | "xl"; tagline?: boolean }) {
  return (
    <div className={cn("inline-flex flex-col items-start leading-none", className)}>
      <span
        className={cn(
          "font-extrabold tracking-tight",
          size === "sm" && "text-2xl",
          size === "md" && "text-3xl",
          size === "lg" && "text-5xl sm:text-6xl",
          size === "xl" && "text-6xl md:text-8xl",
        )}
      >
        <span className="text-gradient animate-shimmer">Partey</span>
        <span className="text-mango">.</span>
      </span>
      {tagline && (
        <span className={cn("mt-1 font-semibold text-muted-foreground", size === "xl" ? "text-2xl md:text-3xl" : "text-base")}>
          Tara, laro!
        </span>
      )}
    </div>
  );
}
