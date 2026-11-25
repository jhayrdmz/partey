/** Option styling: color + letter (never color alone, for accessibility). */
export const CHOICE_STYLES = [
  { letter: "A", bg: "bg-[oklch(0.62_0.22_25)]", ring: "ring-[oklch(0.62_0.22_25)]", bar: "bg-[oklch(0.62_0.22_25)]" },
  { letter: "B", bg: "bg-[oklch(0.58_0.2_255)]", ring: "ring-[oklch(0.58_0.2_255)]", bar: "bg-[oklch(0.58_0.2_255)]" },
  { letter: "C", bg: "bg-[oklch(0.72_0.16_75)]", ring: "ring-[oklch(0.72_0.16_75)]", bar: "bg-[oklch(0.72_0.16_75)]" },
  { letter: "D", bg: "bg-[oklch(0.62_0.17_150)]", ring: "ring-[oklch(0.62_0.17_150)]", bar: "bg-[oklch(0.62_0.17_150)]" },
] as const;

export const choiceStyle = (i: number) => CHOICE_STYLES[i % CHOICE_STYLES.length];
