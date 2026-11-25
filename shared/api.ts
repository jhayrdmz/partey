/** Request/response contracts for callable Cloud Functions. */
import type { GameId } from "./games";
import type { GameMode, RoomStatus } from "./types";

export interface CreateRoomRequest { roomName: string }
export interface CreateRoomResponse { roomId: string; roomCode: string }

export interface SetGameModeRequest { roomId: string; gameMode: GameMode }

export interface SetLineupRequest { roomId: string; lineup: GameId[] }

export interface LookupRoomRequest { roomCode: string }
export interface LookupRoomResponse {
  roomId: string;
  roomName: string;
  status: RoomStatus;
  playerCount: number;
  /** True when the caller already has a player record (reconnect). */
  alreadyJoined: boolean;
  kicked: boolean;
}

export interface JoinRoomRequest { roomCode: string; nickname: string; avatar: string }
export interface JoinRoomResponse { roomId: string; playerId: string; rejoined: boolean }

export interface LeaveRoomRequest { roomId: string }

export interface KickPlayerRequest { roomId: string; playerId: string }

export interface CreatePairingRequest { roomId: string }
export interface CreatePairingResponse { pairingId: string; code: string; expiresAtMs: number }

export interface RequestPairingRequest { code: string; label?: string }
export interface RequestPairingResponse { pairingId: string }

export interface ResolvePairingRequest { roomId: string; pairingId: string; approve: boolean }
export interface ResolvePairingResponse { status: "approved" | "rejected" }

export interface RevokeDisplayRequest { roomId: string; displayId: string }

export interface StartGameRequest { roomId: string; /** Freestyle only: replay or choose a game. */ gameId?: GameId }
export interface EndGameRequest { roomId: string }
export interface CloseRoomRequest { roomId: string }

export type CallableName =
  | "createRoom"
  | "setGameMode"
  | "setLineup"
  | "lookupRoom"
  | "joinRoom"
  | "leaveRoom"
  | "kickPlayer"
  | "createDisplayPairing"
  | "requestDisplayPairing"
  | "resolveDisplayPairing"
  | "revokeDisplay"
  | "startGame"
  | "endGame"
  | "closeRoom";
