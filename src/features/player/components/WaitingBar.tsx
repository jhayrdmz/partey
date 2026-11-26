import { Hourglass } from "lucide-react";
import { motion } from "motion/react";
import { BottomBar } from "@/components/shared/BottomBar";

/**
 * Status pinned to the bottom of the phone while players wait for the host (lobby, between games).
 * Same bar as the game's start countdown; with no deadline, the track just slides along.
 * `waiting={false}` shows the message alone (e.g. the tournament is over).
 */
export function WaitingBar({ label, waiting = true }: { label: string; waiting?: boolean }) {
  return (
    <BottomBar always className="mt-auto space-y-2 self-stretch sm:-mx-4 sm:px-4">
      <p className="flex items-center justify-center gap-2 text-center font-bold text-mango" role="status">
        {waiting && <Hourglass className="size-5 animate-pulse" />} {label}
      </p>
      {waiting && (
        <div className="relative h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
            initial={{ left: "-33%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}
    </BottomBar>
  );
}
