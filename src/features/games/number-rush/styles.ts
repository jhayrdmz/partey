import type { RushChoice } from "@shared/engine";

/*
 * Cartoon game look (chunky outline, glossy top, 3D base), in Partey's colours:
 * HIGHER is green, LOWER is yellow.
 */
export const CARTOON =
  "relative isolate overflow-hidden border-[5px] border-[#2a1240] font-display font-black tracking-wide uppercase transition-[transform,box-shadow,filter] [text-shadow:0_3px_0_rgba(0,0,0,0.3)]";
/** Glossy highlight across the top half. */
export const GLOSS = "pointer-events-none absolute inset-x-2 top-1.5 -z-10 h-[42%] rounded-[inherit] bg-white/35";

export const CHOICE_STYLE: Record<RushChoice, string> = {
  higher:
    "bg-[linear-gradient(#9af266,#3fc23a_55%,#25962b)] text-white shadow-[inset_0_-8px_0_rgba(0,0,0,0.22),0_8px_0_#2a1240]",
  lower:
    "bg-[linear-gradient(#fff07a,#ffc61f_55%,#f29a00)] text-[#4a2200] [text-shadow:0_2px_0_rgba(255,255,255,0.45)] shadow-[inset_0_-8px_0_rgba(0,0,0,0.18),0_8px_0_#2a1240]",
};

export const CHOICE_LABEL: Record<RushChoice, string> = { higher: "Higher", lower: "Lower" };
