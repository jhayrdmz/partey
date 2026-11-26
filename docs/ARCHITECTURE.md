# Partey architecture

## Principles

1. **Clients never write.** Every mutation goes through a callable Cloud Function that validates input, checks the caller's role, and runs in a Firestore transaction. Firestore and RTDB rules grant reads only, except each client may write its *own* RTDB presence node, and Draw & Guess's current artist may write that round's strokes (see below).
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
   | `rooms/{id}/hostSecrets/{gameId}` | host only | host-only game options (The Impostor's custom word) |
   | `displayPairings/{id}` | host who created it; display that requested it | pairing handshake |
   | `roomCodes/*`, `pairingCodes/*`, `rateLimits/*` | nobody | server lookup tables |

4. **The Display is independent.** It has its own Firebase Auth identity and listeners, so it keeps working when the host's browser closes.
5. **Few listeners.** The host uses room + players + display sessions + pairings. A player uses own doc + room + displayState. A display uses session + room + displayState + players. Role bundles are lazy-loaded.

## Callable functions (`functions/src`)

**Input limits.** Every callable starts with `requireUid`, which also refuses request bodies over 8 KB (`MAX_REQUEST_BYTES`). Every text field has a fixed maximum, checked on the server and mirrored by `maxLength` on the matching input: nickname 12, room name 30 (both letters and numbers, with a single space or hyphen between words), display name 40, Impostor clue 24 and custom word 30, Draw & Guess guess 40, host game search 40 (client only). Raw strings far over their limit are refused before they're cleaned or matched (`capRaw`), and arrays in game options are capped too. Draw & Guess strokes are limited by the RTDB rules (only the current artist, ≤ 2,400 characters per chunk).

| Function | Caller | Notes |
|---|---|---|
| `createRoom` | anyone | Generates a unique 4-letter code (no I/O/L/0/1) via `roomCodes/{code}` in a transaction |
| `setGameMode`, `setLineup` | host | Validated against the shared game catalog; freestyle allows one game |
| `setGameSettings` | host | Game options saved on the room as `gameSettings[gameId]`. Speed Quiz: time per question (10s, 15s, 30s or no limit), 8–20 questions, max players 1–100. The Impostor: category, 1–3 impostors (kept a minority at start), 1–3 clue rounds, max players 3–24, and an optional custom word (2–30 characters; needs a real category). The room only stores `customWord: true`; the word goes to the host-only `hostSecrets/impostor` doc and is read by `startGame`. It's single-use: that start deletes it and turns `customWord` back off, in the same transaction. Draw & Guess: 2–20 rounds, 45/60/80/100/120 s to draw, a letter hint every 10/15/20/30 s or none, one or more prompt categories, max players 3–24. Only between games; a running game keeps the options it started with |
| `lookupRoom` | anyone | Resolves code → room; tells the caller if they already joined or were kicked |
| `joinRoom` | player | **Idempotent per uid** (rejoin keeps score); unique nicknames; capacity follows the selected game (Speed Quiz: the host's max players, otherwise 24). Lowering it never removes anyone |
| `leaveRoom`, `kickPlayer` | player / host | Records are kept (`left` / `kicked`) for history; kicked players can't rejoin |
| `createDisplayCode` | display | 6-digit code, crypto-random, TTL `PAIRING_CODE_TTL_SECONDS` (default 180s), shown with a QR code; replaces the display's previous open code; the display auto-refreshes it |
| `claimDisplayPairing` | host | Host enters (or scans) the code shown on the display. **Consumes the code (single use)**, creates `displaySessions/{displayUid}`; rate-limited per uid (10 / 10 min) |
| `revokeDisplay` | host | Display loses access immediately |
| `startGame`, `endGame` | host | Server-side lifecycle; idempotent against double taps; writes history + standings |
| `submitAnswer` | player | One per player per round; validated by the game handler; closes the round early when all have answered. Multi-attempt games (Draw & Guess) answer wrong guesses straight away without storing them, and store only the first correct one |
| `tickGame` | host, players | Advances a phase only once the server clock passes its deadline. With `event: true`, runs a due mid-round event instead (Draw & Guess letter hints), also only once the server clock agrees |
| `controlGame` | host | `pause`, `resume`, `skip` (unscored), `next` (advance now) |
| `closeRoom` | host | Expires the room and cleans it up immediately |
| `onPresenceWritten` | RTDB trigger | Mirrors presence → Firestore, recomputes counts and expiry |
| `onDrawingGameWritten` | Firestore trigger (`gameState/current`) | Draw & Guess: opens the current artist's canvas in RTDB, freezes it on reveal/pause, deletes old strokes |
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

**Optional extension points** (used by The Impostor; the other games ignore them):

| Hook | Where | What it does |
|---|---|---|
| `OpenedRound.eligibleIds` | server | Only these players may answer the round (one clue-giver per turn). Filtered to players still in the room. |
| `OpenedRound.label` / `skippable` | server | Step name shown instead of "Round x of y" (`PublicGameState.roundLabel`); `false` stops the host skipping a round that decides the game. |
| `OpenedRound.privateFor` / `setup` | server | Per-round secrets written to `private/{uid}.secret` (only the artist gets the prompt); state updated as a round opens (who has drawn). `openRound` also receives the players in the room. |
| `OpenedRound.eventAtMs` / `roundEvent` | server | Timed changes during a round (Draw & Guess's letter hints). Published as `PublicGameState.eventAtMs`; devices call `tickGame({ event: true })` when it passes, and pause/resume shift it like the deadline. |
| `check(answer, pub, secret)` / `showAnswerers` | server | Multi-attempt rounds: wrong attempts are rejected without being stored; correct answerers are named live in `PublicGameState.answeredBy` (names only). |
| `ScoredRound.setup` / `totalRounds` / `revealMs` | server | Carry state between rounds (clues so far), add rounds (a revote), and size the reveal (`0` = until the host moves on). |
| `privateInfo(setup, uid)` | server | Per-player secret written to `private/{uid}.secret` at game start (role, secret word). Only that player can read it. |
| `hostAction(name, …)` / `blockAdvance` | server | Game-specific host buttons (`controlGame { action: "game", name }`) and a guard on "Next" (a tied vote must be settled). |
| `validate(answer, pub, { playerId, setup })` | server | Per-player checks (no self-votes; the crew can't type the secret word). |
| `PlayerSecret`, `PlayerReveal` | client views | A private card on the phone in every phase; a custom phone result screen. |
| `hostControls(game)`, `showStandings` | client module | Rename or replace the host's main/skip buttons; hide the "Top scores" strip. |
| `multipleAttempts` | client module | Keep the answer form up while an attempt is checked. |
| `HostView` | client views | A live panel on the host's screen (Draw & Guess's drawing preview). |

### The Impostor

```
intro (peek at your role) ─▶ turn × players × clue rounds ─▶ vote ─┬─ clear winner ─▶ outcome ─▶ finalize
   (role in private/{uid})     one eligible player each;           ├─ tie ─▶ host Revote ─▶ vote (tied players only) …
                               clue shown 3.5 s after each          └─ tie ─▶ host Reveal ─▶ outcome (impostor wins)
```

- **Secrecy:** the word and roles live in `gameState.setup` (server-only) and each player's `private/{uid}.secret`. Public round data only has the category, whose turn it is, the clues given and the ballot; the word appears publicly only in the final outcome.
- **Clues:** the turn player says a word aloud and types it (one word, ≤ 24 characters). The crew can't submit the secret word; an impostor can (rejecting it would confirm their guess). The host's "Next turn" ends a turn without a typed clue ("said aloud"), and Skip passes a disconnected player. Turns time out after 30 s.
- **Voting:** everyone votes at once (60 s, can't be skipped), never for themselves. Ballots are revealed only after the round closes. The most-voted player is accused: an impostor means the crew wins, anyone else means the impostor wins. A shared top spot waits for the host: **Revote** (tied players only) or **Reveal** (the impostor wins).

### Draw & Guess

```
intro ─▶ draw (artist draws, others guess) ─┬─ everyone guessed ─┬─▶ reveal (answer, drawing, points) ─▶ next artist … ─▶ finalize
                                            └─ timer / host ─────┘
```

- **Artists** rotate: each round picks someone in the room who has drawn the fewest times, never the previous artist when anyone else is there, at random among those. Prompts are chosen at game start from the host's categories, never repeat within the game and prefer ones the room hasn't seen (`room.usedContent`).
- **Secrecy:** the prompt lives in `gameState` (server only) and the artist's `private/{uid}.secret`, written as the round opens. Public round data has only the artist, category, the prompt's shape (letters per word) and the strokes key. The host sees the answer only at the reveal. Wrong guesses are never stored or shown anywhere, so the artist can't see guesses.
- **Letter hints:** every N seconds of drawing (host option: 10/15/20/30 s, default 20 s, or off) one more letter appears in the blanks, up to a third of the letters (never half). Which letters, and in what order, is chosen when the round opens and kept in the server-only round secret; each letter is published only when its time comes.
- **Guesses:** case, accents, spacing, punctuation, a leading article and a plural *s* are ignored; prompts can list aliases. One typo away (two for long words) gets "So close!". Prompts: `functions/src/games/drawingContent.ts`.
- **Live strokes** go over the Realtime Database, not Firestore or functions:

  | Path | Written by | Read by |
  |---|---|---|
  | `drawings/{roomId}/access` `{ artistId, key }` | `onDrawingGameWritten` | any signed-in user (not secret) |
  | `drawings/{roomId}/readers/{uid}` | `onDrawingGameWritten` (host, paired displays, players in the room) | nobody |
  | `drawings/{roomId}/strokes/{key}/{strokeId}` `{ c, w, e?, p: { 0: "x,y,…", 1: … } }` | only `access.artistId`, only under `access.key` | `readers` |

  The artist's phone pushes each stroke as small point chunks every 50 ms (integer coordinates on a 1000×1000 square), so writes and listener updates carry only new points; the canvas image is never sent. Undo deletes a stroke, clear deletes the round's strokes. The trigger sets `artistId` while the round is drawing and not paused, clears it on reveal or pause (the canvas freezes but stays readable for the reveal), deletes the previous round's strokes and removes the whole node when the game ends. The room sweep deletes it too. A display paired, or a player joined, mid-game can read strokes from the next phase change.

| Game | Rounds | Scoring |
|---|---|---|
| Speed Quiz | 8–20 × 10/15/30 s or untimed (host options) | correct = 500 + up to 500 speed bonus (linear in time left) |
| Guess the Majority | 6 × 20 s | 500 for picking a most-popular option (ties all count) |
| Reflex Battle | 5 × (2–6 s wait + 3 s) | 500 / 350 / 250 for the fastest three, then 150; a tap before GO is a false start and scores 0 |
| The Impostor | one 30 s turn per player per clue round, then a 60 s vote (+ revotes) | crew catches the impostor: 500 each; impostor survives: 1000 each; any crew member who voted for an impostor: +250 |
| Draw & Guess | 2–20 × 45/60/80/100/120 s (host options; default 6 × 80 s); ends early when everyone has guessed | correct guesses by order: 100 / 80 / 60 / 40, then 20; artist +50 when anyone guesses (`DRAW_POINTS` in `shared/drawing.ts`) |

Reflex timing uses the server's receive time, so network latency counts against everyone. GO is published at round start so screens can flip in sync, which means a scripted client could tap at the exact moment. That's acceptable for a party game, and the design notes record it.

## Tests

- `functions/src/expiry.test.ts`: expiry policy (pure).
- `functions/src/games/games.test.ts`: scoring for Speed Quiz, Guess the Majority and Reflex Battle, content integrity, tie-aware placement points, and Firestore-safe payloads.
- `functions/src/games/drawing.test.ts`: guess matching (case, accents, articles, plurals, aliases, near misses), 100/80/60/40/20 by time + artist bonus, prompt kept out of public data and given to the artist only, fair artist rotation, no repeated prompts, guess validation, Firestore-safe payloads.
- `functions/src/games/impostor.test.ts`: roles and minority rule, turn order (never an impostor first), the word never in public data, clue validation, vote outcomes, tie → revote / reveal, Firestore-safe payloads.
- `functions/src/maintenance.test.ts`: sweep against the emulators (cascade delete, code release, player grace).
- `tests/rules/firestore.rules.test.mjs`: 14 rule checks covering role separation, expired rooms, private and authoritative data, pairing visibility and write denial.
- `tests/e2e/drawing.mjs`: options, the prompt only on the artist's phone (never on the TV, host or other phones), live strokes on the TV and host preview (draw, undo, two-tap clear), wrong / close / right guesses, names-only live guessers, early close, reveal with 100/80/60 + 50, artist rotation, a round nobody guesses, pause freezing the canvas, skip, final results.
- `tests/e2e/impostor.mjs`: options, private role cards, four clue turns (typed, said aloud, secret word rejected then retried), the word kept off the display, a tie → revote → outcome, per-phone win/lose, replay → tie → reveal.
- `tests/e2e/gameplay.mjs`: real play of Speed Quiz, Guess the Majority and Reflex Battle (answers, live counts, early close, pause/resume, skip, false start, timer auto-advance, placement points, champion).
- `tests/e2e/flow.mjs`: full multi-device flow (host tablet, 1080p TV, phones at 320/375/390px), including invalid and reused pairing codes, duplicate nicknames, kick, reconnects, a full tournament and a freestyle setup.
