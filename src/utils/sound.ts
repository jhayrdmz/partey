import { useSoundStore } from "@/stores/soundStore";

/**
 * Tiny Web Audio synth for UI sound effects — no audio assets to load.
 * Browsers only allow audio after a user gesture; displays unlock it on their first tap or key press.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio() {
  void audio()?.resume();
}

/**
 * Unlock audio on the first tap, click or key press anywhere (a TV remote's keys count).
 * Displays have no "Connect" button any more, so they rely on this. Returns a cleanup.
 */
export function unlockAudioOnFirstGesture(): () => void {
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const handler = () => {
    unlockAudio();
    if (audio()?.state === "running") events.forEach((e) => window.removeEventListener(e, handler, true));
  };
  events.forEach((e) => window.addEventListener(e, handler, { capture: true, passive: true }));
  return () => events.forEach((e) => window.removeEventListener(e, handler, true));
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  const ac = audio();
  if (!ac || ac.state !== "running") return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export type SoundName = "join" | "start" | "tick" | "win" | "pop";

export function playSound(name: SoundName) {
  if (useSoundStore.getState().muted) return;
  switch (name) {
    case "join":
      tone(660, 0, 0.12, "triangle");
      tone(990, 0.08, 0.18, "triangle");
      break;
    case "pop":
      tone(880, 0, 0.08, "sine", 0.1);
      break;
    case "tick":
      tone(1200, 0, 0.05, "square", 0.05);
      break;
    case "start":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2, "triangle"));
      break;
    case "win":
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.18));
      break;
  }
}
