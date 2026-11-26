import { describe, expect, it } from "vitest";
import { EXPIRY } from "../../shared/constants";
import { computeExpiresAtMs, type ExpiryInput } from "../../shared/expiry";

const NOW = 1_700_000_000_000;
const base: ExpiryInput = {
  status: "waiting",
  nowMs: NOW,
  lastActivityAtMs: NOW,
  hostConnected: true,
  hostDisconnectedAtMs: null,
  connectedOthers: 2,
  allDisconnectedAtMs: null,
  finishedAtMs: null,
};

describe("computeExpiresAtMs", () => {
  it("expires an idle waiting room after 1 hour of no activity (default)", () => {
    expect(EXPIRY.waitingInactivityMs).toBe(60 * 60_000);
    expect(computeExpiresAtMs(base)).toBe(NOW + EXPIRY.waitingInactivityMs);
  });

  it("uses the configured inactivity window (ROOM_INACTIVITY_MINUTES)", () => {
    expect(computeExpiresAtMs({ ...base, waitingInactivityMs: 15 * 60_000 })).toBe(NOW + 15 * 60_000);
    // Activity moves the deadline: a lobby touched 50 min ago has 10 min left, not 0.
    expect(computeExpiresAtMs({ ...base, lastActivityAtMs: NOW - 50 * 60_000 })).toBe(NOW + 10 * 60_000);
  });

  it("does not expire an active, connected game", () => {
    expect(computeExpiresAtMs({ ...base, status: "playing" })).toBeNull();
  });

  it("gives a disconnected host 8 hours during a game", () => {
    const t = NOW - 1000;
    expect(computeExpiresAtMs({ ...base, status: "playing", hostConnected: false, hostDisconnectedAtMs: t })).toBe(t + EXPIRY.hostGraceMs);
  });

  it("keeps the room alive when one player drops but others remain", () => {
    expect(computeExpiresAtMs({ ...base, status: "playing", connectedOthers: 1 })).toBeNull();
  });

  it("starts the 8 hour room grace when everyone disconnects mid-game", () => {
    const t = NOW - 5000;
    expect(
      computeExpiresAtMs({ ...base, status: "playing", hostConnected: false, hostDisconnectedAtMs: t, connectedOthers: 0, allDisconnectedAtMs: t }),
    ).toBe(t + EXPIRY.allDisconnectedGraceMs);
  });

  it("never lets an empty lobby outlive its 30 minute inactivity window", () => {
    const last = NOW - 10 * 60_000;
    expect(
      computeExpiresAtMs({ ...base, hostConnected: false, connectedOthers: 0, allDisconnectedAtMs: NOW, lastActivityAtMs: last }),
    ).toBe(last + EXPIRY.waitingInactivityMs);
  });

  it("expires a finished room 15 minutes after finishing", () => {
    expect(computeExpiresAtMs({ ...base, status: "finished", finishedAtMs: NOW })).toBe(NOW + EXPIRY.finishedMs);
  });

  it("resets the host timer on reconnection", () => {
    expect(computeExpiresAtMs({ ...base, status: "playing", hostConnected: true, hostDisconnectedAtMs: null })).toBeNull();
  });
});
