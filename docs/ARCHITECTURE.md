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
   | `rooms/{id}/gameState/current` | nobody (server only) | **authoritative** state incl. answers |
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
| `setGameSettings` | host | Speed Quiz options, saved on the room as `gameSettings["speed-quiz"]`: time per question (10s, 15s, 30s or no limit), 8–20 questions, max players 1–100. Only between games; a running game keeps the options it started with |
| `lookupRoom` | anyone | Resolves code → room; tells the caller if they already joined or were kicked |
| `joinRoom` | player | **Idempotent per uid** (rejoin keeps score); unique nicknames; capacity follows the selected game (Speed Quiz: the host's max players, otherwise 24). Lowering it never removes anyone |
| `leaveRoom`, `kickPlayer` | player / host | Records are kept (`left` / `kicked`) for history; kicked players can't rejoin |
| `createDisplayCode` | display | 6-digit code, crypto-random, TTL `PAIRING_CODE_TTL_SECONDS` (default 180s), shown with a QR code; replaces the display's previous open code; the display auto-refreshes it |
| `claimDisplayPairing` | host | Host enters (or scans) the code shown on the display. **Consumes the code (single use)**, creates `displaySessions/{displayUid}`; rate-limited per uid (10 / 10 min) |
| `revokeDisplay` | host | Display loses access immediately |
| `startGame`, `endGame` | host | Server-side lifecycle; idempotent against double taps; writes history + standings |
| `submitAnswer` | player | One per player per round; validated by the game handler; closes the round early when all have answered |
| `tickGame` | host, players | Advances a phase only once the server clock passes its deadline |
| `controlGame` | host | `pause`, `resume`, `skip` (unscored), `next` (advance now) |
| `closeRoom` | host | Expires the room and cleans it up immediately |
| `onPresenceWritten` | RTDB trigger | Mirrors presence → Firestore, recomputes counts and expiry |
| `processExpirations` | every 5 min | Expires rooms, ages out players past the grace period, deletes stale pairing records |

## Display pairing

The display shows the code; the host enters it. Typing (or scanning) the code that is physically on the screen is the host's approval, so there is no separate approve step.

```
Display (TV)                       Server                               Host
 │ createDisplayCode ─────────────▶ pairingCodes/482913 → pairing(open, requesterUid = tv)
 │ shows "482 913" + QR + countdown
 │ listens to its pairing doc (rules: requesterUid == uid)
 │ (gets a fresh code before expiry)
 │                                  ◀──────────── claimDisplayPairing(roomId, "482913")
 │                                                 typed in the lobby, or via the QR →
 │                                                 /host/pair/482913 (one confirming tap)
 │                                  delete pairingCodes/482913 (single use)
 │                                  displaySessions/{tvUid} created
 │                                  pairing.status = approved, roomId, hostId
 │ sees approved → /display/:roomId
```

The public room code is never used to authenticate a display. The display's credential is its own Firebase Auth identity, bound to a `displaySessions` document that only the room's host can create, by entering the code shown on that display. Host-side attempts are rate-limited, so codes can't be brute-forced to push a room onto someone else's screen.

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

## Game engine

Rounds are driven by the server. Clients never decide outcomes, only send intent.

```
startGame ─▶ intro ──(timer | host "next")──▶ question ──(timer | all answered | host)──▶ reveal ──▶ question … ──▶ finalize
                                                  │  host "skip": next round, unscored
                                     pause/resume at any phase (deadlines and Reflex's GO shift)
```

- **Authoritative state:** `gameState/current` is server-only. It holds the chosen content, the current round's public payload *and* its secret (correct answer), the deadline, eligible players and game scores.
- **Public state:** `displayState/current.game` holds the phase, round, server-clock deadline, live answer count, the round payload *without* answers, the reveal (only after the round closes) and the top standings.
- **Private state:** `private/{uid}` holds whether the player answered, their last round result (+points, correct, detail), game score and rank.
- **Clocks:** every device syncs to the server via RTDB `.info/serverTimeOffset`. When a deadline passes, the host and players call `tickGame({round, phase})`. The server advances only if *its* clock agrees (±300 ms), and only if the round and phase still match, so duplicate and early calls are harmless.
- **Submissions:** `submitAnswer` validates the phase, round, eligibility, pause state and deadline (+750 ms in-flight grace), then asks the game handler to normalize the answer. It stores `submissions/{entry}_{round}_{uid}` with `create()`, so each player can answer only once. The server receive time is the timing source. A blind `increment` updates the live count without transaction contention. Once everyone has answered, the round closes early.
- **Scoring:** game points accumulate per round. At the end (last reveal or host "End game"), players are ranked by game points with ties sharing a rank. Tournament mode adds the room's placement points (default 100 / 60 / 30, others 10) to each player's cumulative score. Freestyle sets each player's score to their game points. Each game's standings and placement points are saved in `history`.
- **Content:** questions are server-side (`functions/src/games/*Content.ts`). `room.usedContent` stops questions from repeating within a room.

### Adding a game

1. **Server:** implement `GameHandler` (`functions/src/engine/types.ts`): `setup`, `openRound` (public + secret payloads, duration), `validate`, `score`, and optionally `shiftTimes`. Register it in `engine/registry.ts`. Handlers are pure, so they're easy to unit test (`games.test.ts` also checks payloads are Firestore-safe).
2. **Client:** add `views.tsx` in `src/features/games/<id>/` exporting `DisplayQuestion`, `DisplayReveal`, `PlayerQuestion` (and optionally `PlayerAnswered`), then set `loadViews` in the module's `index.ts`. Views are lazy-loaded per game.
3. Set `playable: true` in `shared/games.ts`.

| Game | Rounds | Scoring |
|---|---|---|
| Speed Quiz | 8 × 15 s | correct = 500 + up to 500 speed bonus (linear in time left) |
| Guess the Majority | 6 × 20 s | 500 for picking a most-popular option (ties all count) |
| Reflex Battle | 5 × (2–6 s wait + 3 s) | 500 / 350 / 250 for the fastest three, then 150; a tap before GO is a false start and scores 0 |

Reflex timing uses the server's receive time, so network latency counts against everyone. GO is published at round start so screens can flip in sync, which means a scripted client could tap at the exact moment. That's acceptable for a party game, and the design notes record it.

## Tests

- `functions/src/expiry.test.ts`: expiry policy (pure).
- `functions/src/games/games.test.ts`: scoring for all three games, content integrity, tie-aware placement points, and Firestore-safe payloads.
- `functions/src/maintenance.test.ts`: sweep against the emulators (cascade delete, code release, player grace).
- `tests/rules/firestore.rules.test.mjs`: 14 rule checks covering role separation, expired rooms, private and authoritative data, pairing visibility and write denial.
- `tests/e2e/gameplay.mjs`: real play of all three games (answers, live counts, early close, pause/resume, skip, false start, timer auto-advance, placement points, champion).
- `tests/e2e/flow.mjs`: full multi-device flow (host tablet, 1080p TV, phones at 320/375/390px), including invalid and reused pairing codes, duplicate nicknames, kick, reconnects, a full tournament and a freestyle setup.
