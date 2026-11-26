import { useLayoutEffect, useRef, useState } from "react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { cn } from "@/utils/cn";

/**
 * A bottom action bar for screens with a text field (e.g. Draw & Guess's guess button). Fixed to
 * the bottom of the screen, and when the on-screen keyboard is up, directly on top of it, even if
 * the page scrolls (a sticky bar would hide behind the keyboard or float mid-screen on iOS).
 * A spacer of the bar's height keeps the content above it. Looks like BottomBar.
 */
export function KeyboardDockedBar({ children, className }: { children: React.ReactNode; className?: string }) {
  const keyboard = useKeyboardInset();
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setHeight(bar.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Reserves the bar's space in the page; data-bottom-bar drops the frame's bottom padding like BottomBar. */}
      <div data-bottom-bar aria-hidden className="mt-auto shrink-0" style={{ height }} />
      <div
        ref={barRef}
        className={cn(
          "fixed inset-x-0 z-30 border-t border-border/60 bg-background/85 px-4 pt-3 backdrop-blur-lg",
          // Over the keyboard the home-indicator inset doesn't apply.
          keyboard > 0 ? "pb-3" : "safe-bottom",
          className,
        )}
        style={{ bottom: keyboard }}
      >
        {/* Same width as PlayerFrame's content column (max-w-md minus its px-4). */}
        <div className="mx-auto w-full max-w-[26rem]">{children}</div>
      </div>
    </>
  );
}
