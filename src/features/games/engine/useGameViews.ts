import { useEffect, useState } from "react";
import type { GameId } from "@shared/games";
import { GAME_MODULES } from "../registry";
import type { GameViews } from "./views";

const cache = new Map<GameId, GameViews>();

/** Lazy-load a game's views so each role only downloads the games it plays. */
export function useGameViews(gameId: GameId | null | undefined): GameViews | null {
  const [views, setViews] = useState<GameViews | null>(() => (gameId ? cache.get(gameId) ?? null : null));
  useEffect(() => {
    if (!gameId) return;
    const cached = cache.get(gameId);
    if (cached) {
      setViews(cached);
      return;
    }
    const load = GAME_MODULES[gameId].loadViews;
    if (!load) return;
    let cancelled = false;
    void load().then((v) => {
      cache.set(gameId, v);
      if (!cancelled) setViews(v);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId]);
  return gameId ? views : null;
}
