import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  QUESTION_SECONDS_OPTIONS,
  SPEED_QUIZ_LIMITS,
  speedQuizSettings,
  type QuestionSeconds,
  type SpeedQuizSettings,
} from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

/** Host-editable Speed Quiz options, saved on the room. */
export function SpeedQuizOptionsDialog({
  room,
  roomId,
  open,
  onOpenChange,
}: {
  room: RoomDoc;
  roomId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {/* Remount on open so the form starts from the saved values. */}
        {open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<SpeedQuizSettings>(() => speedQuizSettings(room.gameSettings?.["speed-quiz"]));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<SpeedQuizSettings>) => setForm((f) => ({ ...f, ...patch }));
  const { maxPlayers, rounds } = SPEED_QUIZ_LIMITS;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "speed-quiz", settings: form });
      toast.success("Speed Quiz options saved", { id: "sq-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Speed Quiz options</DialogTitle>
        <DialogDescription>Applies the next time Speed Quiz starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Time to answer</legend>
          <div role="radiogroup" aria-label="Time to answer" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUESTION_SECONDS_OPTIONS.map((s: QuestionSeconds) => {
              const selected = form.questionSeconds === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ questionSeconds: s })}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                    s === 0 && "leading-tight",
                  )}
                >
                  {s === 0 ? "Until all answer" : `${s}s`}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            {form.questionSeconds === 0
              ? "No timer: each question ends once everyone has answered. You can still end it early with Reveal now."
              : "The question ends when time runs out or everyone has answered. You can also end it early with Reveal now."}
          </p>
        </fieldset>

        <NumberStepper
          label="Number of questions"
          value={form.rounds}
          min={rounds.min}
          max={rounds.max}
          onChange={(v) => update({ rounds: v })}
          hint={`${rounds.min}–${rounds.max} questions.`}
        />

        <NumberStepper
          label="Maximum players"
          value={form.maxPlayers}
          min={maxPlayers.min}
          max={maxPlayers.max}
          step={1}
          bigStep={10}
          onChange={(v) => update({ maxPlayers: v })}
          hint={
            room.playerCount > form.maxPlayers
              ? `${room.playerCount} players have already joined. They stay, but nobody new can join.`
              : `${maxPlayers.min}–${maxPlayers.max}. New players can't join once the room is full.`
          }
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
