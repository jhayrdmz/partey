import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Sticky banner shown while the device or realtime link is offline. */
export function ConnectionBanner({ realtimeConnected = true }: { realtimeConnected?: boolean }) {
  const online = useOnlineStatus();
  const show = !online || !realtimeConnected;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-bold text-black"
          role="status"
        >
          <WifiOff className="size-4" />
          {online ? "Reconnecting to the game…" : "You're offline. We'll reconnect automatically."}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
