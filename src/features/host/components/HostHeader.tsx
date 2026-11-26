import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/utils/cn";

const STEPS = ["Room", "Mode", "Games", "Lobby"] as const;
export type HostStep = (typeof STEPS)[number];

export function HostHeader({ step, backTo, title, subtitle, right }: {
  step?: HostStep;
  backTo?: string;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const current = step ? STEPS.indexOf(step) : -1;
  return (
    <header className="space-y-5">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {backTo ? (
            <Link
              to={backTo}
              aria-label="Back"
              className="grid size-11 place-items-center rounded-xl bg-secondary/70 text-foreground transition hover:bg-secondary"
            >
              <ArrowLeft className="size-5" />
            </Link>
          ) : null}
          <Link to="/" aria-label="Partey home">
            <Logo size="sm" />
          </Link>
        </div>
        {step && (
          <ol className="flex items-center gap-1.5" aria-label="Setup progress">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span
                  aria-current={i === current ? "step" : undefined}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold transition-colors",
                    i < current && "bg-success/20 text-success",
                    i === current && "bg-primary text-primary-foreground",
                    i > current && "bg-secondary text-muted-foreground",
                  )}
                >
                  {i < current ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("hidden text-sm font-semibold md:inline", i === current ? "text-foreground" : "text-muted-foreground")}>{s}</span>
                {i < STEPS.length - 1 && <span className="hidden h-px w-4 bg-border md:block" />}
              </li>
            ))}
          </ol>
        )}
        {right}
      </div>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
      </div>
    </header>
  );
}
