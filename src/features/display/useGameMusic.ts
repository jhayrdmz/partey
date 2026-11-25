import { useEffect, useRef, useState } from "react";

const VOLUME = 0.35;
const FADE_MS = 700;

/**
 * Events that grant the page "user activation", which browsers require before audio can play.
 * Not pointerdown: for touch it doesn't count (only the release does), so tablets never started.
 * Capture phase, so a handler that stops propagation can't swallow the unlock.
 */
const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;

/**
 * One shared <audio> per track for the whole page, so a track survives screen changes: the
 * lobby music keeps playing from the same spot when the pairing screen hands over to the room.
 */
const players = new Map<string, HTMLAudioElement>();
function player(src: string): HTMLAudioElement {
  let audio = players.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    players.set(src, audio);
  }
  return audio;
}

/**
 * Looping background music for the big screen. Fades in when `playing` turns on and out when
 * it turns off; muting or pausing the game stops it. Switching `src` pauses the old track and
 * starts the new one (each track resumes where it left off). When `src` goes away the last
 * track is kept so it can fade out.
 *
 * Browsers block audio until the page has been interacted with. The display is often never
 * touched, so if playback is refused we retry on the first tap or key press.
 */
export function useGameMusic(requestedSrc: string | undefined, playing: boolean) {
  // Keep the last track loaded after the game ends, so it fades out instead of cutting off.
  const [src, setSrc] = useState(requestedSrc);
  if (requestedSrc && requestedSrc !== src) setSrc(requestedSrc);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!src) return;
    const audio = player(src);
    audioRef.current = audio;
    return () => {
      // Pause but keep the position; another screen may pick the same track straight back up.
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const fadeTo = (target: number, done?: () => void) => {
      if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
      const from = audio.volume;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / FADE_MS);
        // Clamp: float rounding can land a hair outside [0, 1], which the browser rejects.
        audio.volume = Math.min(1, Math.max(0, from + (target - from) * t));
        if (t < 1) fadeRef.current = requestAnimationFrame(step);
        else {
          fadeRef.current = null;
          done?.();
        }
      };
      fadeRef.current = requestAnimationFrame(step);
    };

    if (!playing) {
      fadeTo(0, () => audio.pause());
      return;
    }

    let cancelled = false;
    let retry: (() => void) | null = null;
    const removeRetry = () => {
      if (!retry) return;
      UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, retry!, true));
      retry = null;
    };
    const start = () =>
      audio.play().then(
        () => {
          if (!cancelled) fadeTo(VOLUME);
        },
        (err: unknown) => {
          // AbortError = interrupted by pause() (screen change / StrictMode remount), not blocked.
          if (cancelled || (err instanceof DOMException && err.name === "AbortError") || retry) return;
          // Autoplay blocked: start on the first interaction with the display. A gesture that
          // doesn't grant activation (e.g. Escape) just fails again and re-arms this.
          retry = () => {
            removeRetry();
            if (!cancelled) void start();
          };
          UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, retry!, { capture: true, passive: true }));
        },
      );
    void start();
    return () => {
      cancelled = true;
      removeRetry();
    };
  }, [playing, src]);

  // Stop any fade on unmount.
  useEffect(() => () => {
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
  }, []);
}
