/** Avatar catalog. Avatars are referenced by id; clients render emoji + color. */
export interface AvatarDef {
  id: string;
  emoji: string;
  /** Background color token (hex) used behind the emoji. */
  color: string;
  label: string;
}

export const AVATARS: readonly AvatarDef[] = [
  { id: "mango", emoji: "🥭", color: "#f59e0b", label: "Mango" },
  { id: "carabao", emoji: "🐃", color: "#64748b", label: "Carabao" },
  { id: "jeep", emoji: "🚙", color: "#ef4444", label: "Jeepney" },
  { id: "eagle", emoji: "🦅", color: "#a16207", label: "Eagle" },
  { id: "turtle", emoji: "🐢", color: "#22c55e", label: "Pawikan" },
  { id: "fish", emoji: "🐠", color: "#06b6d4", label: "Isda" },
  { id: "rooster", emoji: "🐓", color: "#f97316", label: "Manok" },
  { id: "cat", emoji: "🐱", color: "#eab308", label: "Pusa" },
  { id: "dog", emoji: "🐶", color: "#d97706", label: "Aso" },
  { id: "monkey", emoji: "🐒", color: "#92400e", label: "Unggoy" },
  { id: "frog", emoji: "🐸", color: "#16a34a", label: "Palaka" },
  { id: "octopus", emoji: "🐙", color: "#ec4899", label: "Pugita" },
  { id: "rocket", emoji: "🚀", color: "#6366f1", label: "Rocket" },
  { id: "star", emoji: "⭐", color: "#facc15", label: "Bituin" },
  { id: "fire", emoji: "🔥", color: "#dc2626", label: "Apoy" },
  { id: "ghost", emoji: "👻", color: "#8b5cf6", label: "Multo" },
] as const;

export const AVATAR_IDS = AVATARS.map((a) => a.id);

export function getAvatar(id: string | null | undefined): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
