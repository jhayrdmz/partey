import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

/** − [value] + with a typeable number, clamped to [min, max]. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  bigStep,
  onChange,
  hint,
  warn = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  bigStep?: number;
  onChange: (value: number) => void;
  hint: string;
  warn?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) onChange(clamp(n));
    setDraft(null);
  };
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const stepBtn = "size-12 shrink-0 rounded-md";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {bigStep && (
          <Button type="button" variant="secondary" className={cn(stepBtn, "text-xs font-bold")} onClick={() => onChange(clamp(value - bigStep))} disabled={value <= min} aria-label={`${label}: minus ${bigStep}`}>
            −{bigStep}
          </Button>
        )}
        <Button type="button" variant="secondary" className={stepBtn} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`${label}: decrease`}>
          <Minus />
        </Button>
        <input
          id={id}
          inputMode="numeric"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), e.preventDefault())}
          className="h-12 min-w-0 flex-1 rounded-md border-2 border-input bg-background/60 text-center text-xl font-extrabold tabular-nums outline-none focus:border-primary"
        />
        <Button type="button" variant="secondary" className={stepBtn} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`${label}: increase`}>
          <Plus />
        </Button>
        {bigStep && (
          <Button type="button" variant="secondary" className={cn(stepBtn, "text-xs font-bold")} onClick={() => onChange(clamp(value + bigStep))} disabled={value >= max} aria-label={`${label}: plus ${bigStep}`}>
            +{bigStep}
          </Button>
        )}
      </div>
      <p className={cn("text-sm", warn ? "font-semibold text-warning" : "text-muted-foreground")}>{hint}</p>
    </div>
  );
}
