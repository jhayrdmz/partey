/** Option styling: color + letter (never color alone, for accessibility). */
export const CHOICE_STYLES = [
  // The design's four party colours; light fills, so tiles use dark text.
  { letter: "A", bg: "bg-guava text-background", ring: "ring-guava", bar: "bg-guava" },
  { letter: "B", bg: "bg-sky text-background", ring: "ring-sky", bar: "bg-sky" },
  // Yellow fills always take black text.
  { letter: "C", bg: "bg-mango text-black", ring: "ring-mango", bar: "bg-mango" },
  { letter: "D", bg: "bg-calamansi text-background", ring: "ring-calamansi", bar: "bg-calamansi" },
] as const;

export const choiceStyle = (i: number) => CHOICE_STYLES[i % CHOICE_STYLES.length];
