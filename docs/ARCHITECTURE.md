# Partey architecture

## Principles

1. **Clients never write.** Every mutation goes through a callable Cloud Function that validates input, checks the caller's role, and runs in a Firestore transaction. Firestore and RTDB rules grant reads only, except each client may write its *own* RTDB presence node.
2. **Three strictly separated roles**, each authenticated anonymously:
   - **Host**: `rooms/{roomId}.hostId == uid`
   - **Player**: `rooms/{roomId}/players/{uid}` exists with status `online|offline`
   - **Display**: `rooms/{roomId}/displaySessions/{uid}` exists with `revoked == false`
3. **Public vs. private vs. authoritative data live in different documents**, so a single rule controls each one:

   | Document | Readers | Contents |
   |---|---|---|
   | `rooms/{id}` | host, players, displays | name, code, mode, status, lineup, counts |
   | `rooms/{id}/players/{uid}` | members (+ self) | nickname, avatar, score, status |
   | `rooms/{id}/displayState/current` | members | **public** presentation: screen, game, timer, revealed results |
   | `rooms/{id}/history/{entry}` | members | completed game standings |
   | `rooms/{id}/gameState/current` | host only | **authoritative** state incl. answers |
   | `rooms/{id}/private/{uid}` | that player only | secret words, roles, clues |
   | `rooms/{id}/submissions/*` | nobody (server only) | raw answers until a reveal is published |
   | `rooms/{id}/displaySessions/{uid}` | host; the display itself | paired display sessions |
   | `displayPairings/{id}` | host who created it; display that requested it | pairing handshake |
   | `roomCodes/*`, `pairingCodes/*`, `rateLimits/*` | nobody | server lookup tables |

4. **The Display is independent.** It has its own Firebase Auth identity and listeners, so it keeps working when the host's browser closes.
5. **Few listeners.** The host uses room + players + display sessions + pairings. A player uses own doc + room + displayState. A display uses session + room + displayState + players. Role bundles are lazy-loaded.

## Callable functions (`functions/src`)

| Function | Caller | Notes |
|---|---|---|
| `createRoom` | anyone | Generates a unique 4-letter code (no I/O/L/0/1) via `roomCodes/{code}` in a transaction |
| `setGameMode`, `setLineup` | host | Validated against the shared game catalog; freestyle allows one game |
| `lookupRoom` | anyone | Resolves code → room; tells the caller if they already joined or were kicked |
| `joinRoom` | player | **Idempotent per uid** (rejoin keeps score); unique nicknames; max 24 players |
| `leaveRoom`, `kickPlayer` | player / host | Records are kept (`left` / `kicked`) for history; kicked players can't rejoin |
| `createDisplayPairing` | host | 6-digit code, crypto-random, TTL `PAIRING_CODE_TTL_SECONDS` (default 180s); invalidates the room's previous open code |
| `requestDisplayPairing` | display | **Consumes the code (single use)**; rate-limited per uid (10 / 10 min) |
| `resolveDisplayPairing` | host | Approve → creates `displaySessions/{displayUid}`; idempotent |
| `revokeDisplay` | host | Display loses access immediately |
| `startGame`, `endGame` | host | Server-side lifecycle; idempotent against double taps; writes history + standings |
| `closeRoom` | host | Expires the room and cleans it up immediately |
| `onPresenceWritten` | RTDB trigger | Mirrors presence → Firestore, recomputes counts and expiry |
| `processExpirations` | every 5 min | Expires rooms, ages out players past the grace period, deletes stale pairing records |

## Display pairing

```
Host                          Server                               Display (TV)
 │ createDisplayPairing ─────▶ pairingCodes/123456 → pairing(open)
 │ shows "123 456" + countdown
 │                                                    ◀───── requestDisplayPairing("123456")
 │                             delete pairingCodes/123456 (single use)
 │                             pairing.status = requested, requesterUid = tv
 │ sees "Approve this display?"                       TV listens to pairing doc (rules: requesterUid == uid)
 │ resolveDisplayPairing ────▶ displaySessions/{tvUid} created, pairing approved
 │                                                    TV → /display/:roomId
```

The public room code is never used to authenticate a display. The display's credential is its own Firebase Auth identity, bound to a `displaySessions` document that only the host's approval can create.

## Presence and reconnection

- Each client writes `presence/{roomId}/{uid} = {state, role, lastChanged}` and arms `onDisconnect()` to set `offline`. It re-arms on every reconnect (`.info/connected`).
- `onPresenceWritten` derives the role from Firestore, never from the client. It then updates `players.status`, `displaySessions.connected` or `room.hostConnected`, recounts connected participants, and recomputes `expiresAt`.
- Anonymous sessions persist in IndexedDB, so a refresh or reconnect reuses the same uid. Hosts keep their privileges, players keep their score, and displays stay paired. `joinRoom` is idempotent, so rejoining never duplicates a player.

## Room expiration

The policy lives in `shared/expiry.ts` as a pure, unit-tested function:

| Situation | Expires |
|---|---|
| Waiting room, no activity | 30 min after last activity |
| Host disconnected during a game | 8 h after the host dropped |
| Individual player disconnected | Player becomes `left` after 8 h (score kept); room unaffected |
| Everyone disconnected | 8 h after the last person left |
| Finished | 15 min after finishing |
| Active game with anyone connected | never automatically |

- Every mutation and presence change recomputes `expiresAt`. Reconnecting resets the applicable timer.
- **Expired rooms are inaccessible immediately.** The rules check `status != 'expired' && request.time < expiresAt`, and the functions check the same condition, so access ends even before the sweep runs.
- `processExpirations` tombstones expired rooms (`status: expired`, `ttlAt`). It also explicitly deletes every subcollection with `recursiveDelete` (TTL does not cascade), frees the room code, deletes pairings, and removes RTDB presence.
- Firestore TTL policies on `rooms.ttlAt`, `displayPairings.expiresAt`, `pairingCodes.expiresAt` and `rateLimits.expireAt` handle eventual physical deletion. See the README for the `gcloud` commands.

## Game modules

Each game lives in `src/features/games/<id>/` and exports a `GameModule` with metadata, artwork, how-to-play steps and interaction kinds. Catalog metadata (players, category) is in `shared/games.ts`, so the server validates lineups against the same source. Role shells mount games by id and do not import game internals. When the round engine lands, each module will add its own Host, Player and Display views, plus a server-side handler that reads and writes `gameState`, `private` and `submissions`.

## Tests

- `functions/src/expiry.test.ts`: expiry policy (pure).
- `functions/src/maintenance.test.ts`: sweep against the emulators (cascade delete, code release, player grace).
- `tests/rules/firestore.rules.test.mjs`: 14 rule checks covering role separation, expired rooms, private and authoritative data, pairing visibility and write denial.
- `tests/e2e/flow.mjs`: full multi-device flow (host tablet, 1080p TV, phones at 320/375/390px), including invalid and reused pairing codes, duplicate nicknames, kick, reconnects, a full tournament and a freestyle setup.
