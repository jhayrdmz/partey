/**
 * Firestore document shapes shared by the client and Cloud Functions.
 *
 * Timestamps are typed loosely as `TimestampLike` so this file stays free of
 * SDK imports; the client and the server each map them to their SDK's Timestamp.
 */
import type { GameId } from "./games";
import type { PublicGameState, StandingEntry } from "./engine";

export interface TimestampLike {
  toMillis(): number;
}

export type GameMode = "tournament" | "freestyle";

/**
 * Room lifecycle.
 * - waiting: lobby / setup, no game running
 * - playing: a game is in progress
 * - finished: the tournament or session is over (short expiry)
 * - expired: logically deleted; inaccessible to everyone
 */
export type RoomStatus = "waiting" | "playing" | "finished" | "expired";

export interface LineupEntry {
  /** Stable id for this slot (the same game may appear more than once). */
  entryId: string;
  gameId: GameId;
}

/** rooms/{roomId} — readable by room members (host, players, paired displays). */
export interface RoomDoc {
  roomCode: string;
  hostId: string;
  roomName: string;
  gameMode: GameMode | null;
  status: RoomStatus;
  lineup: LineupEntry[];
  /** Index into lineup of the current/next game. */
  currentGameIndex: number;
  currentGameId: GameId | null;
  /** Tournament placement points (index 0 = 1st place). */
  scoring: { placementPoints: number[]; otherPoints: number };
  /** Content ids already used in this room (avoid repeat questions). */
  usedContent: string[];
  /** Game most recently completed (freestyle: enables Replay / Another game). */
  lastPlayedGameId: GameId | null;
  playerCount: number;
  connectedPlayerCount: number;
  hostConnected: boolean;
  displayCount: number;
  connectedDisplayCount: number;
  createdAt: TimestampLike;
  lastActivityAt: TimestampLike;
  hostDisconnectedAt: TimestampLike | null;
  allDisconnectedAt: TimestampLike | null;
  finishedAt: TimestampLike | null;
  /** Logical expiry. Null = no automatic expiry (active connected game). */
  expiresAt: TimestampLike | null;
  /** Firestore TTL field for eventual physical deletion. */
  ttlAt: TimestampLike | null;
}

export type PlayerStatus = "online" | "offline" | "kicked" | "left";

/** rooms/{roomId}/players/{uid} — public profile + score. */
export interface PlayerDoc {
  nickname: string;
  avatar: string;
  score: number;
  status: PlayerStatus;
  teamId: string | null;
  joinedAt: TimestampLike;
  lastSeenAt: TimestampLike | null;
  disconnectedAt: TimestampLike | null;
}

/** rooms/{roomId}/displaySessions/{displayUid} */
export interface DisplaySessionDoc {
  label: string;
  connected: boolean;
  revoked: boolean;
  pairedAt: TimestampLike;
  lastSeenAt: TimestampLike | null;
}

export type DisplayScreen = "lobby" | "game" | "results" | "leaderboard" | "champion";

/** rooms/{roomId}/displayState/current — PUBLIC presentation data only. */
export interface DisplayStateDoc {
  currentScreen: DisplayScreen;
  gameId: GameId | null;
  /** 1-based position within a tournament lineup. */
  gameNumber: number | null;
  totalGames: number | null;
  /** Live game (screen "game" / "game-intro"); null otherwise. */
  game: PublicGameState | null;
  /** Results/leaderboard/champion screens. */
  publicResults: PublicResults | null;
  updatedAt: TimestampLike;
}

export interface PublicResults {
  /** Overall standings (tournament: cumulative points; freestyle: this game). */
  standings: StandingEntry[];
  /** This game's standings by game points. */
  gameStandings: StandingEntry[];
}

export type PairingStatus = "open" | "requested" | "approved" | "rejected";

/**
 * displayPairings/{pairingId} — temporary, single-use pairing records.
 * Readable only by the room host and (after requesting) the requesting display.
 */
export interface DisplayPairingDoc {
  code: string | null;
  roomId: string;
  hostId: string;
  status: PairingStatus;
  requesterUid: string | null;
  requesterLabel: string | null;
  createdAt: TimestampLike;
  expiresAt: TimestampLike;
  resolvedAt: TimestampLike | null;
}

/** Realtime Database presence node: /presence/{roomId}/{uid} */
export type PresenceRole = "host" | "player" | "display";
export interface PresenceNode {
  state: "online" | "offline";
  role: PresenceRole;
  lastChanged: number | object;
}
