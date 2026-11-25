/** Request/response contracts for callable Cloud Functions. */
import type { GameId } from "./games";
import type { ImpostorSettings, SpeedQuizSettings } from "./gameSettings";
import type { GameMode, RoomStatus } from "./types";

export interface CreateRoomRequest { roomName: string }
export interface CreateRoomResponse { roomId: string; roomCode: string }

export interface SetGameModeRequest { roomId: string; gameMode: GameMode }

export interface SetLineupRequest { roomId: string; lineup: GameId[] }

/** Host changes a game's options in the lobby. */
export type SetGameSettingsRequest =
  | { roomId: string; gameId: "speed-quiz"; settings: SpeedQuizSettings }
  /** `customWord` is required when `settings.customWord` is on; it's stored host-only, never on the room. */
  | { roomId: string; gameId: "impostor"; settings: ImpostorSettings; customWord?: string };

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

/** Display → server: get a pairing code to show on screen. */
export interface CreateDisplayCodeRequest { label?: string }
export interface CreateDisplayCodeResponse { pairingId: string; code: string; expiresAtMs: number }

/** Host → server: connect the display showing `code` to the host's room. */
export interface ClaimDisplayRequest { roomId: string; code: string }
export interface ClaimDisplayResponse { displayId: string; label: string }

export interface RevokeDisplayRequest { roomId: string; displayId: string }

export interface StartGameRequest { roomId: string; /** Freestyle only: replay or choose a game. */ gameId?: GameId }
export interface EndGameRequest { roomId: string }
export interface CloseRoomRequest { roomId: string }

export type CallableName =
  | "createRoom"
  | "setGameMode"
  | "setLineup"
  | "setGameSettings"
  | "lookupRoom"
  | "joinRoom"
  | "leaveRoom"
  | "kickPlayer"
  | "createDisplayCode"
  | "claimDisplayPairing"
  | "revokeDisplay"
  | "startGame"
  | "endGame"
  | "closeRoom";
