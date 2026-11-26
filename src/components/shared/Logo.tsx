import { cn } from "@/utils/cn";

/** Partey wordmark: yellow, with a coral dot (the brand colours). */
export function Logo({ className, size = "md", tagline = false }: { className?: string; size?: "sm" | "md" | "lg" | "xl"; tagline?: boolean }) {
  return (
    <div className={cn("inline-flex flex-col items-start leading-none", className)}>
      <span
        className={cn(
          "font-extrabold tracking-[-0.04em]",
          size === "sm" && "text-2xl",
          size === "md" && "text-3xl",
          size === "lg" && "text-5xl sm:text-6xl",
          size === "xl" && "text-6xl md:text-8xl",
        )}
      >
        <span className="text-mango">Partey</span>
        <span className="text-guava">.</span>
      </span>
      {tagline && (
        <span className={cn("mt-1 font-semibold text-muted-foreground", size === "xl" ? "text-2xl md:text-3xl" : "text-base")}>
          Tara, laro!
        </span>
      )}
    </div>
  );
}
