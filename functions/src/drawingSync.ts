import { onDocumentWritten } from "firebase-functions/v2/firestore";
import type { DrawRound } from "../../shared/engine";
import { accessPath, drawingPath, type DrawAccess } from "../../shared/drawing";
import { roomRef, rtdb } from "./lib/admin";
import type { GameStateDoc } from "./engine/state";
import { REGION } from "./config";

/**
 * Draw & Guess: keeps the Realtime Database canvas in step with the authoritative game state.
 *
 *   question (not paused) → access = { artist, round key }: only that player can draw, only there
 *   reveal / paused       → access.artistId = null: the drawing freezes, still readable for the reveal
 *   next round            → the previous round's strokes are deleted
 *   game over             → the whole drawings/{roomId} node is deleted
 *
 * `readers` (host, paired displays, players in the room) is refreshed on every change, so only
 * room members can watch. Strokes go straight from the artist to the database: no function runs
 * per stroke. Rules: database.rules.json.
 */
export const onDrawingGameWritten = onDocumentWritten({ document: "rooms/{roomId}/gameState/current", region: REGION }, async (event) => {
  const { roomId } = event.params;
  const before = event.data?.before.data() as GameStateDoc | undefined;
  const after = event.data?.after.data() as GameStateDoc | undefined;
  if (before?.gameId !== "drawing" && after?.gameId !== "drawing") return;

  // Triggers can arrive out of order: act on the latest state, not the event's.
  const [gsSnap, roomSnap, displays, players] = await Promise.all([
    roomRef(roomId).collection("gameState").doc("current").get(),
    roomRef(roomId).get(),
    roomRef(roomId).collection("displaySessions").where("revoked", "==", false).get(),
    roomRef(roomId).collection("players").where("status", "in", ["online", "offline"]).get(),
  ]);
  const gs = gsSnap.data() as GameStateDoc | undefined;
  const node = rtdb().ref(drawingPath(roomId));
  if (!gs || gs.gameId !== "drawing" || gs.status !== "active" || !roomSnap.exists) {
    await node.remove();
    return;
  }

  const pub = gs.phase === "intro" ? null : (gs.roundPublic as DrawRound | null);
  const key = pub?.drawingKey ?? null;
  const artistId = pub && gs.phase === "question" && !gs.paused ? pub.artist.playerId : null;
  const previous = ((await rtdb().ref(accessPath(roomId)).get()).val() as DrawAccess | null)?.key ?? null;

  const readers: Record<string, true> = { [roomSnap.get("hostId") as string]: true };
  for (const d of displays.docs) readers[d.id] = true;
  // Players watch a small live copy on their phones too (the drawing is public anyway: it's on the TV).
  for (const p of players.docs) readers[p.id] = true;
  if (pub) readers[pub.artist.playerId] = true;

  const access: DrawAccess = { artistId, key };
  await node.update({
    access,
    readers,
    ...(previous && previous !== key ? { [`strokes/${previous}`]: null } : {}),
  });
});

