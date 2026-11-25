import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * Segmented code input backed by ONE real <input> (so paste, autofill and
 * screen readers work). Visual boxes are rendered behind it.
 */
export function CodeInput({
  value,
  onChange,
  length,
  mode = "numeric",
  autoFocus,
  disabled,
  invalid,
  label,
  className,
  boxClassName,
  onComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
  mode?: "numeric" | "alpha";
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  className?: string;
  /** Extra classes for each box (e.g. a different corner radius). */
  boxClassName?: string;
  onComplete?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Back up the autoFocus attribute, which some browsers skip when a route swaps in without a
  // full page load. (iOS Safari still won't focus or open the keyboard without a tap.)
  useEffect(() => {
    if (!autoFocus) return;
    const id = requestAnimationFrame(() => {
      if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [autoFocus]);
  const sanitize = (raw: string) =>
    (mode === "numeric" ? raw.replace(/\D/g, "") : raw.toUpperCase().replace(/[^A-Z]/g, "")).slice(0, length);

  // Group gap after the third digit for 6-digit numeric codes.
  const grouped = length === 6;

  return (
    <div
      // Fluid: boxes keep their full size (--box) when there's room and shrink evenly when
      // the container is narrower, so the input never overflows its card.
      className={cn(
        "relative mx-auto w-full [--box:2.25rem] [--gap:0.375rem] [--group:0.375rem]",
        "xs:[--box:2.5rem] xs:[--gap:0.5rem] sm:[--box:4rem] sm:[--gap:0.75rem] sm:[--group:1rem]",
        className,
      )}
      style={{ maxWidth: `calc(${length} * var(--box) + ${length - 1} * var(--gap)${grouped ? " + var(--group)" : ""})` }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex w-full gap-(--gap)" aria-hidden>
        {Array.from({ length }, (_, i) => {
          const ch = value[i] ?? "";
          const active = i === Math.min(value.length, length - 1);
          return (
            <span
              key={i}
              className={cn(
                "grid min-w-0 flex-1 aspect-[3/4] place-items-center rounded-xl border-2 bg-background/60 text-xl font-extrabold transition-colors xs:aspect-[5/7] xs:text-2xl sm:aspect-[4/5] sm:text-4xl",
                ch ? "border-primary/70 text-white" : "border-input text-muted-foreground",
                active && focused && !disabled && "border-primary ring-4 ring-primary/25",
                invalid && "border-destructive",
                grouped && i === 3 && "ml-(--group)",
                boxClassName,
              )}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode={mode === "numeric" ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoCapitalize={mode === "alpha" ? "characters" : "off"}
        autoCorrect="off"
        spellCheck={false}
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = sanitize(e.target.value);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        className="absolute inset-0 h-full w-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-0 outline-none focus:opacity-0"
      />
    </div>
  );
}
