import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { firebase } from "./app";

/**
 * Everyone (host, player, display) uses anonymous auth. The session persists in
 * IndexedDB, so a refresh or reconnect keeps the same uid — that's what lets a
 * host regain host privileges and a player keep their score.
 */
export function watchAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, callback);
}

let pending: Promise<User> | null = null;

export async function ensureSignedIn(): Promise<User> {
  const { auth } = firebase();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  pending ??= signInAnonymously(auth)
    .then((cred) => cred.user)
    .finally(() => {
      pending = null;
    });
  return pending;
}
