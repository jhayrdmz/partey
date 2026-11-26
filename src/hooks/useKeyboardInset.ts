import { useEffect, useState } from "react";

/** Below this, the gap is browser chrome (URL bar), not a keyboard. */
const MIN_KEYBOARD_PX = 80;

/**
 * How many pixels of the layout viewport's bottom are hidden (by the on-screen keyboard).
 *
 * iOS Safari (and browsers ignoring `interactive-widget=resizes-content`) keep the layout viewport
 * full height when the keyboard opens and only shrink and scroll the *visual* viewport, so
 * `position: fixed; bottom: 0` ends up behind the keyboard. Offsetting by this keeps a bar on top
 * of it. Re-measured as the visual viewport resizes or scrolls; 0 when there's no keyboard.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      setInset(hidden >= MIN_KEYBOARD_PX ? hidden : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
