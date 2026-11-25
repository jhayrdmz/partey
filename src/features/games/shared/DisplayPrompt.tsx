import { cn } from "@/utils/cn";

/**
 * Big-screen question text. Its size follows `--fit-q` (set by the display's FitToScreen),
 * so long questions shrink instead of pushing the answers off screen.
 */
export function DisplayPrompt({ prompt, hint, hintClassName }: { prompt: string; hint?: string; hintClassName?: string }) {
  return (
    <div className="space-y-2 text-center sm:space-y-3">
      {hint && <p className={cn("text-base font-bold tracking-wide uppercase sm:text-xl lg:text-2xl", hintClassName)}>{hint}</p>}
      <h2 className="mx-auto max-w-5xl text-[length:calc(1.5rem*var(--fit-q,1))] leading-tight font-extrabold text-balance break-words sm:text-[length:calc(2.25rem*var(--fit-q,1))] lg:text-[length:calc(3.75rem*var(--fit-q,1))]">
        {prompt}
      </h2>
    </div>
  );
}
