import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ListOrdered, Loader2, SearchX } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { GameCategory } from "@shared/games";
import { Backdrop } from "@/components/shared/Backdrop";
import { BottomBar } from "@/components/shared/BottomBar";
import { StateBlock } from "@/components/shared/ScreenState";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GAME_LIST, getGame } from "@/features/games/registry";
import { call, errorMessage } from "@/services/firebase";
import { useLineupDraft } from "@/stores/lineupDraftStore";
import { CategoryFilter } from "../components/CategoryFilter";
import { GameCard } from "../components/GameCard";
import { HostHeader } from "../components/HostHeader";
import { LineupEditor } from "../components/LineupEditor";
import { cn } from "@/utils/cn";
import { useHostContext } from "../HostRoomLayout";

export function GameSelectScreen() {
  const { room } = useHostContext();
  const navigate = useNavigate();
  const mode = room.gameMode ?? "freestyle";
  const draft = useLineupDraft();
  const [category, setCategory] = useState<GameCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Seed the local draft from the saved lineup once per room.
  const { init } = draft;
  useEffect(() => {
    init(room.id, room.lineup.map((e) => e.gameId));
  }, [init, room.id, room.lineup]);

  const games = useMemo(() => {
    const q = search.trim().toLowerCase();
    return GAME_LIST.filter(
      (g) =>
        (category === "all" || g.meta.category === category) &&
        (!q || g.meta.name.toLowerCase().includes(q) || g.meta.description.toLowerCase().includes(q) || g.meta.category.includes(q)),
    );
  }, [category, search]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of draft.entries) map.set(e.gameId, (map.get(e.gameId) ?? 0) + 1);
    return map;
  }, [draft.entries]);

  const totalMinutes = draft.entries.reduce((sum, e) => sum + getGame(e.gameId).meta.durationMin, 0);
  const canSave = draft.entries.length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await call("setLineup", { roomId: room.id, lineup: draft.entries.map((e) => e.gameId) });
      navigate(`/host/${room.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  function select(gameId: (typeof GAME_LIST)[number]["id"]) {
    if (mode === "tournament") {
      draft.add(gameId);
      toast.success(`${getGame(gameId).meta.name} added`, { duration: 1200, id: "lineup-add" });
    } else {
      draft.set(gameId);
    }
  }

  const selectedFreestyle = mode === "freestyle" ? draft.entries[0] : undefined;
  const continueLabel =
    mode === "tournament"
      ? draft.entries.length > 0
        ? `Continue with ${draft.entries.length} game${draft.entries.length === 1 ? "" : "s"}`
        : "Add games to continue"
      : selectedFreestyle
        ? `Play ${getGame(selectedFreestyle.gameId).meta.name}`
        : "Pick a game to continue";

  const saveButton = (
    <Button size="xl" className="w-full min-w-0" disabled={!canSave} onClick={save}>
      {saving ? <Loader2 className="animate-spin" /> : null}
      <span className="truncate">{saving ? "Saving…" : continueLabel}</span>
      {!saving && draft.entries.length > 0 && <ArrowRight />}
    </Button>
  );

  return (
    <Backdrop confettiOn={false}>
      <main className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-8">
        <HostHeader
          step="Games"
          backTo={`/host/${room.id}/mode`}
          title={mode === "tournament" ? "Build your tournament" : "Pick a game"}
          subtitle={
            mode === "tournament"
              ? "Tap games to add them to the lineup. Repeat favorites and set the order."
              : "Choose one game to play. You can switch after every game."
          }
        />

        {/* Only tournaments have the lineup sidebar; freestyle gives the library the full width. */}
        <div
          className={cn(
            "mt-6 grid grid-cols-1 gap-6",
            mode === "tournament" && "lg:grid-cols-[1fr_25rem] lg:items-start xl:grid-cols-[1fr_27rem]",
          )}
        >
          <section aria-label="Game library" className="min-w-0 space-y-4">
            <CategoryFilter category={category} onCategory={setCategory} search={search} onSearch={setSearch} />
            {games.length === 0 ? (
              <StateBlock
                icon={SearchX}
                title="No games found"
                message="Try a different search or category."
                className="py-12"
                action={<Button variant="outline" onClick={() => { setSearch(""); setCategory("all"); }}>Show all games</Button>}
              />
            ) : (
              <div
                className={cn(
                  // Phones: one card per row so art and details stay readable.
                  "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3",
                  mode === "tournament" ? "lg:grid-cols-2 xl:grid-cols-3" : "xl:grid-cols-4",
                )}
              >
                {games.map((g) => (
                  <GameCard key={g.id} game={g} mode={mode} count={counts.get(g.id) ?? 0} playerCount={room.playerCount} onSelect={() => select(g.id)} />
                ))}
              </div>
            )}
          </section>

          {/* Tablet landscape / desktop: persistent lineup sidebar. */}
          {mode === "tournament" && (
            <aside className="hidden lg:sticky lg:top-6 lg:block">
              <div className="space-y-4 rounded-2xl border bg-card/80 p-5 backdrop-blur">
                <h2 className="flex items-center gap-2 text-lg font-extrabold">
                  <ListOrdered className="size-5 text-primary" /> Lineup
                </h2>
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  <LineupEditor entries={draft.entries} onMove={draft.move} onRemove={draft.remove} totalMinutes={totalMinutes} />
                </div>
                {saveButton}
              </div>
            </aside>
          )}
        </div>

        {/* Freestyle: sticky at every width so "Play …" is always in reach, however long the library. */}
        <BottomBar always={mode === "freestyle"} className={mode === "tournament" ? "lg:hidden" : "sm:mt-8"}>
          <div className="flex gap-2">
            {mode === "tournament" && (
              <Button size="xl" variant="secondary" className="px-4" onClick={() => setSheetOpen(true)} aria-label="Review lineup">
                <ListOrdered />
                <span className="tabular-nums">{draft.entries.length}</span>
              </Button>
            )}
            <div className="min-w-0 flex-1">{saveButton}</div>
          </div>
        </BottomBar>
        {mode === "tournament" && <div className="hidden h-10 sm:block lg:hidden" />}
      </main>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-h-[85dvh]">
          <DialogHeader>
            <DialogTitle>Tournament lineup</DialogTitle>
            <DialogDescription>Reorder or remove games. Games play top to bottom.</DialogDescription>
          </DialogHeader>
          <div className="-mx-2 overflow-y-auto px-2">
            <LineupEditor entries={draft.entries} onMove={draft.move} onRemove={draft.remove} totalMinutes={totalMinutes} />
          </div>
          {saveButton}
        </DialogContent>
      </Dialog>
    </Backdrop>
  );
}
