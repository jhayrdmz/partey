import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  SCRAMBLE_CATEGORY_LABELS,
  SCRAMBLE_CATEGORY_OPTIONS,
  SCRAMBLE_DIFFICULTY_LABELS,
  SCRAMBLE_DIFFICULTY_OPTIONS,
  SCRAMBLE_LIMITS,
  SCRAMBLE_POINTS,
  SCRAMBLE_ROUND_PRESETS,
  SCRAMBLE_SECONDS_OPTIONS,
  scrambleSettings,
  type ScrambleSettings,
} from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

const OPTION = "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors";
const on = (selected: boolean) => (selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground");

/** Host-editable options for Word Scramble, saved on the room. */
export function ScrambleOptionsDialog({ room, roomId, open, onOpenChange }: { room: RoomDoc; roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">{open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function Radios<T extends string | number>({ label, options, value, onChange, render, cols }: { label: string; options: readonly T[]; value: T | null; onChange: (v: T) => void; render: (v: T) => string; cols: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", cols)}>
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cn(OPTION, on(value === o))}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-bold">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-secondary")}
      >
        <span className={cn("absolute top-1 size-6 rounded-full bg-white transition-transform", checked ? "translate-x-7" : "translate-x-1")} />
      </button>
    </div>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<ScrambleSettings>(() => scrambleSettings(room.gameSettings?.["word-scramble"]));
  const [custom, setCustom] = useState(() => !(SCRAMBLE_ROUND_PRESETS as readonly number[]).includes(form.rounds));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<ScrambleSettings>) => setForm((f) => ({ ...f, ...patch }));
  const L = SCRAMBLE_LIMITS;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "word-scramble", settings: form });
      toast.success("Word Scramble options saved", { id: "scramble-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Word Scramble options</DialogTitle>
        <DialogDescription>Applies the next time Word Scramble starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Rounds</legend>
          <Radios<number | "custom">
            label="Rounds"
            cols="grid-cols-4"
            options={[...SCRAMBLE_ROUND_PRESETS, "custom"]}
            value={custom ? "custom" : form.rounds}
            render={(v) => (v === "custom" ? "Custom" : String(v))}
            onChange={(v) => {
              if (v === "custom") setCustom(true);
              else {
                setCustom(false);
                update({ rounds: v });
              }
            }}
          />
          {custom && (
            <NumberStepper label="Custom rounds" value={form.rounds} min={L.rounds.min} max={L.rounds.max} onChange={(v) => update({ rounds: v })} hint={`${L.rounds.min}–${L.rounds.max} words.`} />
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Time per word</legend>
          <Radios label="Time per word" cols="grid-cols-4" options={SCRAMBLE_SECONDS_OPTIONS} value={form.roundSeconds} render={(s) => `${s}s`} onChange={(s) => update({ roundSeconds: s })} />
          <p className="text-sm text-muted-foreground">Players can guess once every {L.cooldownMs / 1000} seconds. The round ends early once everyone has solved it.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Difficulty</legend>
          <Radios label="Difficulty" cols="grid-cols-4" options={SCRAMBLE_DIFFICULTY_OPTIONS} value={form.difficulty} render={(d) => SCRAMBLE_DIFFICULTY_LABELS[d]} onChange={(d) => update({ difficulty: d })} />
          <p className="text-sm text-muted-foreground">Easy: 3–5 letters · Medium: 6–8 · Hard: 9 or more · Mixed: a bit of everything.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Category</legend>
          <Radios label="Category" cols="grid-cols-2" options={SCRAMBLE_CATEGORY_OPTIONS} value={form.category} render={(c) => SCRAMBLE_CATEGORY_LABELS[c]} onChange={(c) => update({ category: c })} />
        </fieldset>

        <Toggle label="Hints" hint="Reveal the first letter halfway through, then the last letter." checked={form.hints} onChange={(hints) => update({ hints })} />
        <Toggle label="Speed bonus" hint={`Up to +${SCRAMBLE_POINTS.speedBonusMax} extra for solving it fast.`} checked={form.speedBonus} onChange={(speedBonus) => update({ speedBonus })} />

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
