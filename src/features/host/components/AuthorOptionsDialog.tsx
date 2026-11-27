import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AUTHOR_CATEGORY_LABELS, AUTHOR_CATEGORY_OPTIONS, AUTHOR_GUESS_SECONDS_OPTIONS, AUTHOR_LIMITS, AUTHOR_ROUND_PRESETS, AUTHOR_WRITE_SECONDS_OPTIONS, authorSettings, type AuthorSettings } from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

const OPTION = "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors";
const on = (selected: boolean) => (selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground");

/** Host-editable options for The Author, saved on the room. */
export function AuthorOptionsDialog({ room, roomId, open, onOpenChange }: { room: RoomDoc; roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">{open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<AuthorSettings>(() => authorSettings(room.gameSettings?.["the-author"]));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<AuthorSettings>) => setForm((f) => ({ ...f, ...patch }));
  const L = AUTHOR_LIMITS;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "the-author", settings: form });
      toast.success("The Author options saved", { id: "author-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>The Author options</DialogTitle>
        <DialogDescription>Applies the next time The Author starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Rounds</legend>
          <div role="radiogroup" aria-label="Rounds" className="grid grid-cols-3 gap-2">
            {AUTHOR_ROUND_PRESETS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.rounds === n} onClick={() => update({ rounds: n })} className={cn(OPTION, on(form.rounds === n))}>
                {n}
              </button>
            ))}
          </div>
          {!(AUTHOR_ROUND_PRESETS as readonly number[]).includes(form.rounds) && <p className="text-sm text-muted-foreground">Currently {form.rounds} rounds.</p>}
          <p className="text-sm text-muted-foreground">Each round is one question: everyone writes an answer, then the room guesses who wrote each one.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Category</legend>
          {/* Random on its own row, then the six categories in 2–3 columns, so long names like Relationships fit. */}
          <div role="radiogroup" aria-label="Category" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AUTHOR_CATEGORY_OPTIONS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.category === n} onClick={() => update({ category: n })} className={cn(OPTION, "min-w-0 break-words", n === "random" && "col-span-full", on(form.category === n))}>
                {AUTHOR_CATEGORY_LABELS[n]}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Random mixes categories, a different one each round.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Time to write</legend>
          <div role="radiogroup" aria-label="Time to write" className="grid grid-cols-4 gap-2">
            {AUTHOR_WRITE_SECONDS_OPTIONS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.writeSeconds === n} onClick={() => update({ writeSeconds: n })} className={cn(OPTION, on(form.writeSeconds === n))}>
                {n}s
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Time to guess</legend>
          <div role="radiogroup" aria-label="Time to guess" className="grid grid-cols-3 gap-2">
            {AUTHOR_GUESS_SECONDS_OPTIONS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.guessSeconds === n} onClick={() => update({ guessSeconds: n })} className={cn(OPTION, on(form.guessSeconds === n))}>
                {n}s
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Writing and guessing end early once everyone is in.</p>
        </fieldset>

        <NumberStepper
          label="Maximum players"
          value={form.maxPlayers}
          min={L.maxPlayers.min}
          max={L.maxPlayers.max}
          onChange={(v) => update({ maxPlayers: v })}
          hint={room.playerCount > form.maxPlayers ? `${room.playerCount} players have already joined. They stay, but nobody new can join.` : `${L.maxPlayers.min}–${L.maxPlayers.max}. New players can't join once the room is full.`}
          warn={room.playerCount > form.maxPlayers}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} Save options
        </Button>
      </DialogFooter>
    </>
  );
}
