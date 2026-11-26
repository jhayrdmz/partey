import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DRAW_CATEGORIES } from "@shared/engine";
import { DRAWING_LIMITS, DRAW_CATEGORY_LABELS, DRAW_SECONDS_OPTIONS, HINT_SECONDS_OPTIONS, drawingSettings, type DrawingSettings } from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

/** Host-editable options for Draw & Guess, saved on the room. */
export function DrawingOptionsDialog({ room, roomId, open, onOpenChange }: { room: RoomDoc; roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<DrawingSettings>(() => drawingSettings(room.gameSettings?.drawing));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<DrawingSettings>) => setForm((f) => ({ ...f, ...patch }));
  const L = DRAWING_LIMITS;
  const all = form.categories.length === DRAW_CATEGORIES.length;
  const toggle = (c: DrawingSettings["categories"][number]) =>
    update({ categories: form.categories.includes(c) ? form.categories.filter((x) => x !== c) : DRAW_CATEGORIES.filter((x) => x === c || form.categories.includes(x)) });
  const players = room.playerCount;
  const turns = players > 0 ? Math.floor(form.rounds / players) : 0;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "drawing", settings: form });
      toast.success("Draw & Guess options saved", { id: "draw-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Draw & Guess options</DialogTitle>
        <DialogDescription>Applies the next time Draw & Guess starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <NumberStepper
          label="Rounds"
          value={form.rounds}
          min={L.rounds.min}
          max={L.rounds.max}
          onChange={(v) => update({ rounds: v })}
          hint={
            players >= L.minPlayers
              ? form.rounds < players
                ? `One drawing per round. With ${players} players, ${players - form.rounds} won't get to draw.`
                : `One drawing per round. With ${players} players, everyone draws ${turns === 1 ? "once" : `${turns} times`}${form.rounds % players ? " (some once more)" : ""}.`
              : "One drawing per round. Artists take turns, so everyone draws before anyone draws twice."
          }
          warn={players >= L.minPlayers && form.rounds < players}
        />

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Drawing time</legend>
          <div role="radiogroup" aria-label="Drawing time" className="grid grid-cols-5 gap-2">
            {DRAW_SECONDS_OPTIONS.map((s) => {
              const selected = form.drawSeconds === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ drawSeconds: s })}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-1 py-2 text-sm font-bold tabular-nums transition-colors",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}s
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">The round ends early once everyone has guessed.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Letter hints</legend>
          <div role="radiogroup" aria-label="Letter hints" className="grid grid-cols-5 gap-2">
            {HINT_SECONDS_OPTIONS.map((s) => {
              const selected = form.hintSeconds === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={s === 0 ? "No hints" : `A letter every ${s} seconds`}
                  onClick={() => update({ hintSeconds: s })}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-1 py-2 text-sm font-bold tabular-nums transition-colors",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === 0 ? "Off" : `${s}s`}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            {form.hintSeconds === 0
              ? "No letters are shown: guessers only see the blanks."
              : `Every ${form.hintSeconds}s of drawing, one letter of the prompt appears in the blanks (up to a third of the word).`}
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="font-bold">Categories</legend>
            <Button type="button" size="sm" variant="ghost" onClick={() => update({ categories: all ? [] : [...DRAW_CATEGORIES] })}>
              {all ? "Clear all" : "Select all"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DRAW_CATEGORIES.map((c) => {
              const selected = form.categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggle(c)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-md border-2 px-3 py-2 text-left text-sm font-bold transition-colors",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                    {selected && <Check className="size-3.5" />}
                  </span>
                  {DRAW_CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
          <p className={cn("text-sm", form.categories.length === 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {form.categories.length === 0 ? "Pick at least one category." : "Prompts are picked at random from these, and don't repeat in this room."}
          </p>
        </fieldset>

        <NumberStepper
          label="Maximum players"
          value={form.maxPlayers}
          min={L.maxPlayers.min}
          max={L.maxPlayers.max}
          onChange={(v) => update({ maxPlayers: v })}
          hint={
            room.playerCount > form.maxPlayers
              ? `${room.playerCount} players have already joined. They stay, but nobody new can join.`
              : `${L.maxPlayers.min}–${L.maxPlayers.max}. New players can't join once the room is full.`
          }
          warn={room.playerCount > form.maxPlayers}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || form.categories.length === 0}>
          {saving && <Loader2 className="animate-spin" />} Save options
        </Button>
      </DialogFooter>
    </>
  );
}
