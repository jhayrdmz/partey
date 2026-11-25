import { useEffect, useState } from "react";
import type { DocumentData, DocumentReference, FirestoreError, Query } from "firebase/firestore";
import { subscribeDoc, subscribeQuery, type WithId } from "@/services/firebase";

export type LiveStatus = "loading" | "ready" | "error";

export interface LiveDoc<T> {
  data: WithId<T> | null;
  status: LiveStatus;
  error: FirestoreError | null;
}

/**
 * Subscribe to a single document. Pass `null` to skip (e.g. until auth is ready).
 * `key` must change whenever the ref changes (refs aren't referentially stable).
 */
export function useLiveDoc<T extends DocumentData>(ref: DocumentReference<T> | null, key: string): LiveDoc<T> {
  const [state, setState] = useState<LiveDoc<T>>({ data: null, status: "loading", error: null });
  useEffect(() => {
    if (!ref) return;
    setState((s) => ({ ...s, status: "loading", error: null }));
    return subscribeDoc(
      ref,
      (data) => setState({ data, status: "ready", error: null }),
      (error) => {
        if (import.meta.env.DEV) console.warn(`[firestore] listener ${key} failed:`, error.code);
        setState({ data: null, status: "error", error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export interface LiveQuery<T> {
  data: WithId<T>[];
  status: LiveStatus;
  error: FirestoreError | null;
}

export function useLiveQuery<T extends DocumentData>(q: Query<T> | null, key: string): LiveQuery<T> {
  const [state, setState] = useState<LiveQuery<T>>({ data: [], status: "loading", error: null });
  useEffect(() => {
    if (!q) return;
    setState((s) => ({ ...s, status: "loading", error: null }));
    return subscribeQuery(
      q,
      (data) => setState({ data, status: "ready", error: null }),
      (error) => {
        if (import.meta.env.DEV) console.warn(`[firestore] listener ${key} failed:`, error.code);
        setState({ data: [], status: "error", error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
