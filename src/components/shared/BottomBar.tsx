import { cn } from "@/utils/cn";

/** Primary action area: sticky to the bottom on phones, inline from tablet up. */
export function BottomBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border/60 bg-background/85 px-4 pt-3 backdrop-blur-lg safe-bottom",
        "sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
