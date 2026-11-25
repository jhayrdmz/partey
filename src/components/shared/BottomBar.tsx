import { cn } from "@/utils/cn";

/**
 * Primary action area: sticky to the bottom on phones, inline from tablet up.
 * `always` keeps it sticky at every width; the parent must then use `px-4 sm:px-6`
 * so the bar's negative margins reach the edges.
 */
export function BottomBar({ children, className, always = false }: { children: React.ReactNode; className?: string; always?: boolean }) {
  return (
    <div
      data-bottom-bar
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border/60 bg-background/85 px-4 pt-3 backdrop-blur-lg safe-bottom",
        always ? "sm:-mx-6 sm:px-6" : "sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
