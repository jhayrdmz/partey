/**
 * Large media (game music) lives in Cloudflare R2, not in the app bundle.
 * VITE_MEDIA_BASE_URL is the bucket's public URL; without it, media is simply skipped.
 */
export function mediaUrl(path: string): string | undefined {
  const base = import.meta.env.VITE_MEDIA_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/${path}` : undefined;
}

/** Object keys in the R2 bucket (see README → "Media on Cloudflare R2"). */
export const MEDIA = {
  speedQuizMusic: "music/speed-quiz/disco-funk-fever.mp3",
  reflexBattleMusic: "music/reflex-battle/space-cat-slot-machine.mp3",
  majorityMusic: "music/majority/brass-band-on-the-hill.mp3",
  /** Display pairing screen, room lobby and between games: waiting for the host. */
  lobbyMusic: "music/lobby/santa-town-festival.mp3",
} as const;
