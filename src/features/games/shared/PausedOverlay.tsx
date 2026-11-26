import { Pause } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Full-screen "Paused" cover with a blurred backdrop. The same on the big screen and on players'
 * phones, so everyone sees the game is on hold (and nobody keeps drawing or guessing under it).
 */
export function PausedOverlay({ paused }: { paused: boolean }) {
  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          key="paused"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-30 grid place-items-center bg-background/70 backdrop-blur-sm"
        >
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="flex flex-col items-center gap-4">
            <Pause className="size-16 text-mango sm:size-24" />
            <p className="text-4xl font-black sm:text-6xl">Paused</p>
            <p className="px-6 text-center text-lg text-muted-foreground sm:text-2xl">The host will resume the game shortly.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
