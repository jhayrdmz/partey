import { create } from "zustand";
import type { User } from "firebase/auth";

type AuthStatus = "idle" | "loading" | "ready" | "error";

interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  set: (patch: Partial<Omit<AuthState, "set">>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  error: null,
  set: (patch) => set(patch),
}));
