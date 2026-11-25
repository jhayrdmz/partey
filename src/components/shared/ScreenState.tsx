import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Backdrop } from "./Backdrop";

interface ScreenStateProps {
  icon?: LucideIcon;
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "error";
  className?: string;
}

/** Centered state block for empty / error / info states. */
export function StateBlock({ icon: Icon = AlertTriangle, title, message, action, tone = "default", className }: ScreenStateProps) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-4 px-4 text-center", className)}>
      <span
        className={cn(
          "grid size-16 place-items-center rounded-2xl",
          tone === "error" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
        )}
      >
        <Icon className="size-8" />
      </span>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      {message && <div className="text-muted-foreground">{message}</div>}
      {action && <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">{action}</div>}
    </div>
  );
}

/** Full-page version of StateBlock. */
export function ScreenState(props: ScreenStateProps) {
  return (
    <Backdrop>
      <main className="grid min-h-dvh place-items-center py-10">
        <StateBlock {...props} />
      </main>
    </Backdrop>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <Backdrop confettiOn={false}>
      <main className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="size-10 animate-spin text-primary" />
          <span className="font-semibold">{label}</span>
        </div>
      </main>
    </Backdrop>
  );
}
