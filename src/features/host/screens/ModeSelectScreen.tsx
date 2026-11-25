import { useState } from "react";
import { Check, Loader2, Repeat, Trophy } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { GameMode } from "@shared/types";
import { Backdrop } from "@/components/shared/Backdrop";
import { call, errorMessage } from "@/services/firebase";
import { cn } from "@/utils/cn";
import { HostHeader } from "../components/HostHeader";
import { useHostContext } from "../HostRoomLayout";

const MODES: { id: GameMode; title: string; icon: React.ElementType; description: string; features: string[]; gradient: string }[] = [
  {
    id: "tournament",
    title: "Tournament Mode",
    icon: Trophy,
    description: "Play a series of games and compete for the overall championship.",
    features: ["Pick multiple games & set the order", "Points add up across games", "Leaderboard between games", "Crown an overall champion"],
    gradient: "from-mango/30 via-guava/20 to-primary/30",
  },
  {
    id: "freestyle",
    title: "Freestyle Mode",
    icon: Repeat,
    description: "Play individual games whenever you want.",
    features: ["Pick one game at a time", "Every game is its own competition", "Winner announced after each game", "Switch games anytime"],
    gradient: "from-sky/30 via-accent/20 to-calamansi/20",
  },
];

export function ModeSelectScreen() {
  const { room } = useHostContext();
  const navigate = useNavigate();
  const [pending, setPending] = useState<GameMode | null>(null);
  const locked = room.status !== "waiting" || (room.gameMode === "tournament" && room.currentGameIndex > 0);

  async function choose(mode: GameMode) {
    if (pending || locked) return;
    setPending(mode);
    try {
      await call("setGameMode", { roomId: room.id, gameMode: mode });
      navigate(`/host/${room.id}/games`);
    } catch (err) {
      toast.error(errorMessage(err));
      setPending(null);
    }
  }

  return (
    <Backdrop>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-10 sm:px-6 sm:pt-8">
        <HostHeader
          step="Mode"
          backTo={room.gameMode && room.lineup.length > 0 ? `/host/${room.id}` : undefined}
          title="Choose a game mode"
          subtitle={<>How do you want to play in <span className="font-bold text-foreground">{room.roomName}</span>?</>}
        />
        <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-2">
          {MODES.map((mode) => {
            const selected = room.gameMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => choose(mode.id)}
                disabled={Boolean(pending) || locked}
                aria-pressed={selected}
                className={cn(
                  "group relative flex flex-col gap-5 overflow-hidden rounded-3xl border-2 bg-card/70 p-6 text-left transition-all outline-none sm:p-8",
                  "focus-visible:ring-4 focus-visible:ring-ring/50 active:scale-[0.99] disabled:cursor-not-allowed",
                  selected ? "border-primary shadow-2xl shadow-primary/30" : "border-border hover:border-primary/60",
                )}
              >
                <div aria-hidden className={cn("absolute inset-0 -z-0 bg-gradient-to-br opacity-60", mode.gradient)} />
                <div className="relative flex items-start justify-between gap-4">
                  <span className="grid size-16 place-items-center rounded-2xl bg-background/50 text-white shadow-inner">
                    <Icon className="size-8" />
                  </span>
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full border-2 transition",
                      selected ? "border-primary bg-primary text-white" : "border-border",
                    )}
                  >
                    {pending === mode.id ? <Loader2 className="size-4 animate-spin" /> : selected ? <Check className="size-5" /> : null}
                  </span>
                </div>
                <div className="relative space-y-2">
                  <h2 className="text-2xl font-extrabold sm:text-3xl">{mode.title}</h2>
                  <p className="text-base text-foreground/80 sm:text-lg">{mode.description}</p>
                </div>
                <ul className="relative space-y-2.5">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm font-medium text-foreground/90 sm:text-base">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-background/50">
                        <Check className="size-3.5 text-calamansi" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        {locked && <p className="mt-6 text-center text-sm text-muted-foreground">The mode is locked once games have started.</p>}
      </main>
    </Backdrop>
  );
}
