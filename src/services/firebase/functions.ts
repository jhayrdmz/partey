import { httpsCallable, FunctionsError } from "firebase/functions";
import type * as Api from "@shared/api";
import type * as Engine from "@shared/engine";
import { firebase } from "./app";
import { ensureSignedIn } from "./auth";

/** Request/response map for every callable. Keeps call sites fully typed. */
interface CallableMap {
  createRoom: [Api.CreateRoomRequest, Api.CreateRoomResponse];
  setGameMode: [Api.SetGameModeRequest, { ok: true }];
  setLineup: [Api.SetLineupRequest, { ok: true }];
  setGameSettings: [Api.SetGameSettingsRequest, { ok: true }];
  lookupRoom: [Api.LookupRoomRequest, Api.LookupRoomResponse];
  joinRoom: [Api.JoinRoomRequest, Api.JoinRoomResponse];
  leaveRoom: [Api.LeaveRoomRequest, { ok: true }];
  kickPlayer: [Api.KickPlayerRequest, { ok: true }];
  createDisplayCode: [Api.CreateDisplayCodeRequest, Api.CreateDisplayCodeResponse];
  claimDisplayPairing: [Api.ClaimDisplayRequest, Api.ClaimDisplayResponse];
  revokeDisplay: [Api.RevokeDisplayRequest, { ok: true }];
  startGame: [Api.StartGameRequest, { ok: true }];
  endGame: [Api.EndGameRequest, { ok: true }];
  closeRoom: [Api.CloseRoomRequest, { ok: true }];
  keepAlive: [Api.KeepAliveRequest, { ok: true }];
  submitAnswer: [Engine.SubmitAnswerRequest, Engine.SubmitAnswerResponse];
  tickGame: [Engine.TickGameRequest, { advanced: boolean }];
  controlGame: [Engine.ControlGameRequest, { ok: true }];
}

export async function call<K extends keyof CallableMap>(name: K, data: CallableMap[K][0]): Promise<CallableMap[K][1]> {
  await ensureSignedIn();
  const fn = httpsCallable<CallableMap[K][0], CallableMap[K][1]>(firebase().functions, name);
  const result = await fn(data);
  return result.data;
}

/** Human-readable message for any error thrown by `call`. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof FunctionsError) {
    if (err.code === "functions/internal" || err.code === "functions/unavailable") return "Can't reach the game server. Check your connection.";
    // The SDK appends the HTTP status ("… [400]"); our server messages are meant to be shown as-is.
    return err.message.replace(/\s*\[\d{3}\]$/, "") || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Extra info a callable attached to its error (e.g. which limit was hit). */
export function errorDetails<T = unknown>(err: unknown): T | null {
  return err instanceof FunctionsError ? ((err.details as T | undefined) ?? null) : null;
}

export function errorCode(err: unknown): string | null {
  return err instanceof FunctionsError ? err.code.replace("functions/", "") : null;
}
