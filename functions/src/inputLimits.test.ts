import { describe, expect, it } from "vitest";
import type { CallableRequest } from "firebase-functions/v2/https";
import { DRAW_CATEGORIES } from "../../shared/engine";
import { MAX_REQUEST_BYTES, requireUid } from "./lib/errors";
import * as v from "./lib/validate";
import { drawing } from "./games/drawing";
import { impostor } from "./games/impostor";

const players = ["a", "b", "c", "d"].map((id) => ({ playerId: id, nickname: id.toUpperCase(), avatar: "mango" }));
const huge = "x".repeat(1_000_000);
const req = (data: unknown, contentLength?: number) =>
  ({ auth: { uid: "u1" }, data, rawRequest: { headers: contentLength ? { "content-length": String(contentLength) } : {} } }) as unknown as CallableRequest<unknown>;

describe("input limits (spam protection)", () => {
  it("refuses oversized requests before any work", () => {
    expect(requireUid(req({ roomName: "Party" }, 40))).toBe("u1");
    expect(() => requireUid(req({ roomName: "Party" }, MAX_REQUEST_BYTES + 1))).toThrow(/too large/);
    // No Content-Length: the parsed payload is measured instead.
    expect(() => requireUid(req({ roomName: huge }))).toThrow(/too large/);
  });

  it("refuses huge strings without cleaning them first", () => {
    expect(() => v.text({ s: huge }, "s", 1, 40, "Display name")).toThrow(/at most 40/);
    expect(() => v.name({ s: huge }, "s", 1, 12, "Nickname")).toThrow(/at most 12/);
    expect(() => v.roomCode({ roomCode: huge })).toThrow(/4 letters/);
    expect(() => v.pairingCode({ code: huge })).toThrow(/digit code/);
    expect(() => v.impostorCustomWord({ customWord: huge })).toThrow(/at most 30/);
  });

  it("caps arrays in game options", () => {
    const base = { rounds: 6, drawSeconds: 80, hintSeconds: 20, maxPlayers: 12 };
    expect(() => v.drawingSettings({ ...base, categories: Array(10_000).fill("animals") })).toThrow(/Too many/);
    expect(v.drawingSettings({ ...base, categories: [...DRAW_CATEGORIES] }).categories).toHaveLength(DRAW_CATEGORIES.length);
  });

  it("caps game answers: guesses and clues", () => {
    const { setup } = drawing.setup(players, new Set());
    const r = drawing.openRound(setup, 1, 0, players);
    expect(() => drawing.validate({ guess: huge }, r.public, { playerId: "a", setup })).toThrow(/at most 40/);
    const imp = impostor.setup(players, new Set());
    const turn = impostor.openRound(imp.setup, 1, 0, players);
    expect(() => impostor.validate({ clue: huge }, turn.public, { playerId: "a", setup: imp.setup })).toThrow(/at most 24/);
  });
});
