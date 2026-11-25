import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
  type Query,
  type DocumentReference,
} from "firebase/firestore";
import type { DisplayPairingDoc, DisplaySessionDoc, DisplayStateDoc, PlayerDoc, RoomDoc } from "@shared/types";
import { firebase } from "./app";

export type WithId<T> = T & { id: string };

const db = () => firebase().firestore;

export const refs = {
  room: (roomId: string) => doc(db(), "rooms", roomId) as DocumentReference<RoomDoc>,
  player: (roomId: string, uid: string) => doc(db(), "rooms", roomId, "players", uid) as DocumentReference<PlayerDoc>,
  players: (roomId: string) => collection(db(), "rooms", roomId, "players") as unknown as Query<PlayerDoc>,
  displayState: (roomId: string) => doc(db(), "rooms", roomId, "displayState", "current") as DocumentReference<DisplayStateDoc>,
  displaySession: (roomId: string, uid: string) =>
    doc(db(), "rooms", roomId, "displaySessions", uid) as DocumentReference<DisplaySessionDoc>,
  displaySessions: (roomId: string) => collection(db(), "rooms", roomId, "displaySessions") as unknown as Query<DisplaySessionDoc>,
  pairing: (pairingId: string) => doc(db(), "displayPairings", pairingId) as DocumentReference<DisplayPairingDoc>,
  hostPairings: (roomId: string, hostId: string) =>
    query(
      collection(db(), "displayPairings"),
      where("roomId", "==", roomId),
      where("hostId", "==", hostId),
      where("status", "in", ["open", "requested"]),
    ) as Query<DisplayPairingDoc>,
  activePlayers: (roomId: string) =>
    query(collection(db(), "rooms", roomId, "players"), where("status", "in", ["online", "offline"])) as Query<PlayerDoc>,
};

export type Unsubscribe = () => void;

export function subscribeDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  onData: (data: WithId<T> | null) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    ref,
    (snap) => onData(snap.exists() ? { ...(snap.data() as T), id: snap.id } : null),
    onError,
  );
}

export function subscribeQuery<T extends DocumentData>(
  q: Query<T>,
  onData: (data: WithId<T>[]) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))), onError);
}

/** One-shot read; resolves null when missing or not permitted. */
export async function fetchDoc<T extends DocumentData>(ref: DocumentReference<T>): Promise<WithId<T> | null> {
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? { ...(snap.data() as T), id: snap.id } : null;
  } catch {
    return null;
  }
}
