import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AVATARS } from "@shared/avatars";

interface PlayerProfileState {
  nickname: string;
  avatar: string;
  setNickname: (nickname: string) => void;
  setAvatar: (avatar: string) => void;
}

/** Remembers the player's last nickname/avatar on this device. */
export const usePlayerProfile = create<PlayerProfileState>()(
  persist(
    (set) => ({
      nickname: "",
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)].id,
      setNickname: (nickname) => set({ nickname }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    { name: "partey.player-profile" },
  ),
);
