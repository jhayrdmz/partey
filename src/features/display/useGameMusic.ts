import { useEffect, useRef, useState } from "react";

const VOLUME = 0.35;
const FADE_MS = 700;

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
        audio.volume = from + (target - from) * t;
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

    let retry: (() => void) | null = null;
    const start = () =>
      audio.play().then(
        () => fadeTo(VOLUME),
        () => {
          // Autoplay blocked: wait for the first interaction with the display.
          retry = () => {
            removeRetry();
            void start();
          };
          window.addEventListener("pointerdown", retry, { once: true });
          window.addEventListener("keydown", retry, { once: true });
        },
      );
    const removeRetry = () => {
      if (!retry) return;
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      retry = null;
    };
    void start();
    return removeRetry;
  }, [playing, src]);

  // Stop any fade on unmount.
  useEffect(() => () => {
    if (fadeRef.current !== null) cancelAnimationFrame(fadeRef.current);
  }, []);
}
