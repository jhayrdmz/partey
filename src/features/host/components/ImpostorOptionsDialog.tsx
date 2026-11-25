import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  IMPOSTOR_CATEGORY_LABELS,
  IMPOSTOR_CATEGORY_OPTIONS,
  IMPOSTOR_LIMITS,
  impostorSettings,
  maxImpostorsFor,
  type ImpostorSettings,
} from "@shared/gameSettings";
import type { RoomDoc } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call, errorMessage, fetchDoc, refs } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { NumberStepper } from "./NumberStepper";

/** Host-editable options for The Impostor, saved on the room. */
export function ImpostorOptionsDialog({ room, roomId, open, onOpenChange }: { room: RoomDoc; roomId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        {open && <OptionsForm room={room} roomId={roomId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function OptionsForm({ room, roomId, onDone }: { room: RoomDoc; roomId: string; onDone: () => void }) {
  const [form, setForm] = useState<ImpostorSettings>(() => impostorSettings(room.gameSettings?.impostor));
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<ImpostorSettings>) => setForm((f) => ({ ...f, ...patch }));
  const L = IMPOSTOR_LIMITS;
  // The saved custom word lives in a host-only doc, not on the room; load it to edit.
  const savedCustom = Boolean(room.gameSettings?.impostor?.customWord);
  const [word, setWord] = useState("");
  const [wordLoading, setWordLoading] = useState(savedCustom);
  const [showWord, setShowWord] = useState(false);
  useEffect(() => {
    if (!savedCustom) return;
    let live = true;
    fetchDoc(refs.impostorSecret(roomId))
      .then((d) => live && setWord(d?.word ?? ""))
      .catch(() => live && toast.error("Couldn't load your custom word. Type it again."))
      .finally(() => live && setWordLoading(false));
    return () => {
      live = false;
    };
  }, [savedCustom, roomId]);
  const trimmedWord = word.replace(/\s+/g, " ").trim();
  const wordLength = [...trimmedWord].length;
  const needsCategory = form.customWord && form.category === "random";
  const wordInvalid = form.customWord && (wordLength < L.customWord.min || wordLength > L.customWord.max);
  const canSave = !saving && !wordLoading && !needsCategory && !wordInvalid;
  // Impostors must stay a minority of the players who'll actually play.
  const players = room.playerCount;
  const allowed = players >= L.minPlayers ? maxImpostorsFor(players) : null;

  async function save() {
    setSaving(true);
    try {
      await call("setGameSettings", { roomId, gameId: "impostor", settings: form, ...(form.customWord ? { customWord: trimmedWord } : {}) });
      toast.success("The Impostor options saved", { id: "imp-options" });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>The Impostor options</DialogTitle>
        <DialogDescription>Applies the next time The Impostor starts.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Secret word</legend>
          <div role="radiogroup" aria-label="Secret word" className="grid grid-cols-2 gap-2">
            {([
              [false, "Random word"],
              [true, "Custom word"],
            ] as const).map(([custom, label]) => {
              const selected = form.customWord === custom;
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ customWord: custom })}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {form.customWord && (
            <div className="space-y-2 pt-2">
              <label htmlFor="imp-custom-word" className="sr-only">
                Custom word
              </label>
              <div className="relative">
                <Input
                  id="imp-custom-word"
                  type={showWord ? "text" : "password"}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={L.customWord.max}
                  placeholder={wordLoading ? "Loading…" : "e.g. Pizza"}
                  disabled={wordLoading}
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  aria-invalid={wordInvalid && word.length > 0}
                  aria-describedby="imp-custom-word-hint"
                  className="pr-14"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1.5 size-11 -translate-y-1/2"
                  onClick={() => setShowWord((s) => !s)}
                  aria-label={showWord ? "Hide word" : "Show word"}
                  aria-pressed={showWord}
                >
                  {showWord ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <p id="imp-custom-word-hint" className="text-sm text-muted-foreground">
                Hidden from players and the display. The crew sees it on their phones; the impostor only gets the category. Used for the next game only, then it's back to random words. {L.customWord.min}–{L.customWord.max} characters.
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Category</legend>
          <div role="radiogroup" aria-label="Category" className="grid grid-cols-3 gap-2">
            {IMPOSTOR_CATEGORY_OPTIONS.map((c) => {
              const selected = form.category === c;
              // A custom word needs a real category: it's the impostor's only hint.
              const disabled = form.customWord && c === "random";
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => update({ category: c })}
                  className={cn(
                    "min-h-12 rounded-md border-2 px-2 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selected ? "border-primary bg-primary/15 text-foreground" : "border-input bg-secondary/40 text-muted-foreground hover:text-foreground",
                    selected && disabled && "border-destructive bg-transparent",
                  )}
                >
                  {IMPOSTOR_CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
          {form.customWord && (
            <p className={cn("text-sm", needsCategory ? "font-semibold text-destructive" : "text-muted-foreground")}>
              {needsCategory ? "Pick the category your word fits. It's the impostor's only hint." : "The category your word fits. It's the impostor's only hint."}
            </p>
          )}
        </fieldset>

        <NumberStepper
          label="Impostors"
          value={form.impostors}
          min={L.impostors.min}
          max={L.impostors.max}
          onChange={(v) => update({ impostors: v })}
          hint={
            allowed !== null && form.impostors > allowed
              ? `With ${players} players you can have at most ${allowed}. Add players or lower this before starting.`
              : "Impostors must be fewer than half the players (3–4 players: 1, 5–6: 2, 7+: 3)."
          }
          warn={allowed !== null && form.impostors > allowed}
        />

        <NumberStepper
          label="Clue rounds"
          value={form.clueRounds}
          min={L.clueRounds.min}
          max={L.clueRounds.max}
          onChange={(v) => update({ clueRounds: v })}
          hint="How many times everyone gives a clue before the vote."
        />

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
        <Button onClick={save} disabled={!canSave}>
          {saving && <Loader2 className="animate-spin" />} Save options
        </Button>
      </DialogFooter>
    </>
  );
}
