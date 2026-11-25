import { create } from "zustand";
import type { GameId } from "@shared/games";

export interface DraftEntry {
  key: string;
  gameId: GameId;
}

interface LineupDraftState {
  roomId: string | null;
  entries: DraftEntry[];
  init: (roomId: string, gameIds: GameId[]) => void;
  add: (gameId: GameId) => void;
  set: (gameId: GameId) => void;
  remove: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
  clear: () => void;
}

let counter = 0;
const key = () => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Host's local, unsaved game lineup while browsing the library. */
export const useLineupDraft = create<LineupDraftState>((set, get) => ({
  roomId: null,
  entries: [],
  init: (roomId, gameIds) => {
    if (get().roomId === roomId) return;
    set({ roomId, entries: gameIds.map((gameId) => ({ key: key(), gameId })) });
  },
  add: (gameId) => set((s) => ({ entries: [...s.entries, { key: key(), gameId }] })),
  set: (gameId) => set({ entries: [{ key: key(), gameId }] }),
  remove: (k) => set((s) => ({ entries: s.entries.filter((e) => e.key !== k) })),
  move: (k, direction) =>
    set((s) => {
      const i = s.entries.findIndex((e) => e.key === k);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= s.entries.length) return s;
      const entries = [...s.entries];
      [entries[i], entries[j]] = [entries[j], entries[i]];
      return { entries };
    }),
  clear: () => set({ entries: [] }),
}));
