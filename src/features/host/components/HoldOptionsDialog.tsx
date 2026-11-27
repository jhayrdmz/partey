import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HOLD_LIMITS, HOLD_RANGES, HOLD_RANGE_LABELS, HOLD_RANGE_OPTIONS, HOLD_ROUND_PRESETS, holdSettings, type HoldSettings } from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

const OPTION = "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors";
const on = (selected: boolean) => (selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground");

/** Host-editable options for Perfectly Hold, saved on the room. */
export function HoldOptionsDialog({ room, roomId, open, onOpenChange }: { room: RoomDoc; roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">{open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<HoldSettings>(() => holdSettings(room.gameSettings?.["perfectly-hold"]));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<HoldSettings>) => setForm((f) => ({ ...f, ...patch }));
  const L = HOLD_LIMITS;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "perfectly-hold", settings: form });
      toast.success("Perfectly Hold options saved", { id: "hold-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Perfectly Hold options</DialogTitle>
        <DialogDescription>Applies the next time Perfectly Hold starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Rounds</legend>
          <div role="radiogroup" aria-label="Rounds" className="grid grid-cols-4 gap-2">
            {HOLD_ROUND_PRESETS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={form.rounds === n} onClick={() => update({ rounds: n })} className={cn(OPTION, on(form.rounds === n))}>
                {n}
              </button>
            ))}
          </div>
          {!(HOLD_ROUND_PRESETS as readonly number[]).includes(form.rounds) && <p className="text-sm text-muted-foreground">Currently {form.rounds} rounds.</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Target times</legend>
          <div role="radiogroup" aria-label="Target times" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HOLD_RANGE_OPTIONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={form.range === r} onClick={() => update({ range: r })} className={cn(OPTION, "flex flex-col items-center leading-tight", on(form.range === r))}>
                {HOLD_RANGE_LABELS[r]}
                <span className="text-xs font-semibold opacity-80">
                  {HOLD_RANGES[r].min}–{HOLD_RANGES[r].max}s
                </span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Each round picks a random target in this range. Everyone gets the same one.</p>
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
