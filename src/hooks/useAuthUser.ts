import { useEffect } from "react";
import { ensureSignedIn, errorMessage, watchAuth } from "@/services/firebase";
import { useAuthStore } from "@/stores/authStore";

/** Ensures an (anonymous) Firebase user exists and returns it. */
export function useAuthUser() {
  const { user, status, error, set } = useAuthStore();

  useEffect(() => {
    const unsubscribe = watchAuth((u) => {
      if (u) set({ user: u, status: "ready", error: null });
    });
    if (useAuthStore.getState().status === "idle") {
      set({ status: "loading" });
      ensureSignedIn().catch((err) => set({ status: "error", error: errorMessage(err, "Couldn't sign in.") }));
    }
    return unsubscribe;
  }, [set]);

  return { user, status, error };
}
