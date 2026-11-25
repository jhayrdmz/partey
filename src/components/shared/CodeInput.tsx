import { useRef, useState } from "react";
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
  onComplete?: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const sanitize = (raw: string) =>
    (mode === "numeric" ? raw.replace(/\D/g, "") : raw.toUpperCase().replace(/[^A-Z]/g, "")).slice(0, length);

  return (
    <div className={cn("relative mx-auto w-fit", className)} onClick={() => inputRef.current?.focus()}>
      <div className="flex gap-1.5 xs:gap-2 sm:gap-3" aria-hidden>
        {Array.from({ length }, (_, i) => {
          const ch = value[i] ?? "";
          const active = i === Math.min(value.length, length - 1);
          return (
            <span
              key={i}
              className={cn(
                "grid h-12 w-9 place-items-center rounded-xl border-2 bg-background/60 text-xl font-extrabold transition-colors xs:h-14 xs:w-10 xs:text-2xl sm:h-20 sm:w-16 sm:text-4xl",
                ch ? "border-primary/70 text-white" : "border-input text-muted-foreground",
                active && focused && !disabled && "border-primary ring-4 ring-primary/25",
                invalid && "border-destructive",
                // Group gap after the third digit for 6-digit numeric codes.
                length === 6 && i === 3 && "ml-1.5 sm:ml-4",
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
