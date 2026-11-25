import { useLayoutEffect, useRef } from "react";
import { cn } from "@/utils/cn";

/**
 * One scale (MIN_SCALE–1) drives two CSS variables that descendants opt into, e.g.
 * `text-[length:calc(2.25rem*var(--fit-q,1))]`: --fit-q for the question text and --fit-c
 * for answer tiles and other body content. They shrink together so the hierarchy holds;
 * the body stops at BODY_MIN so answers stay readable while a long question keeps shrinking.
 */
const MIN_SCALE = 0.5;
const BODY_MIN = 0.65;

/**
 * Keeps its content inside the available height (the display has no scrolling or controls
 * during a game). If the content is too tall it first shrinks the text (the question more than
 * the answers), and as a last resort zooms the whole block out.
 *
 * Re-fits when the box resizes (e.g. the standings strip sliding in below) and when `watch`
 * changes (new content in the same view).
 */
export function FitToScreen({ children, className, watch }: { children: React.ReactNode; className?: string; watch?: unknown }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fits = () => inner.scrollHeight <= outer.clientHeight + 1;
    const set = (name: string, value: number) => inner.style.setProperty(name, value.toFixed(3));

    const scale = (s: number) => {
      set("--fit-q", s);
      set("--fit-c", Math.max(BODY_MIN, s));
    };

    const fit = () => {
      inner.style.zoom = "";
      scale(1);
      if (fits()) return;
      scale(MIN_SCALE);
      if (fits()) {
        // Largest scale that fits (lo always fits).
        let lo = MIN_SCALE, hi = 1;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          scale(mid);
          if (fits()) lo = mid;
          else hi = mid;
        }
        scale(lo);
        return;
      }
      // Still too tall at every minimum: scale everything. Zoom also widens the line length,
      // so the result can only get shorter than this ratio predicts.
      inner.style.zoom = String(Math.max(0.3, (outer.clientHeight / inner.scrollHeight) * 0.98));
    };

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(outer);
    void document.fonts?.ready.then(schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [watch]);

  return (
    <div ref={outerRef} className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      <div ref={innerRef} className="absolute inset-x-0 top-0 flex min-h-full flex-col">
        {children}
      </div>
    </div>
  );
}
