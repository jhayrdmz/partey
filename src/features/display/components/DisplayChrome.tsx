import { useEffect, useState } from "react";
import { Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { useSoundStore } from "@/stores/soundStore";
import { cn } from "@/utils/cn";

/** Floating fullscreen + mute controls that fade out when the pointer is idle. */
export function DisplayChrome({ hostOnline }: { hostOnline: boolean }) {
  const { muted, toggle } = useSoundStore();
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    let t = window.setTimeout(() => setVisible(false), 3500);
    const show = () => {
      setVisible(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setVisible(false), 3500);
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("pointermove", show);
    window.addEventListener("keydown", show);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointermove", show);
      window.removeEventListener("keydown", show);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <>
      {!hostOnline && (
        <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-warning px-5 py-2 text-lg font-bold text-black shadow-lg">
          Host disconnected — waiting for them to come back…
        </div>
      )}
      <div className={cn("fixed right-4 bottom-4 z-40 flex gap-2 transition-opacity duration-500", visible ? "opacity-100" : "pointer-events-none opacity-0")}>
        <button type="button" onClick={toggle} aria-label={muted ? "Unmute" : "Mute"} className="glass grid size-14 place-items-center rounded-2xl border">
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
        {document.fullscreenEnabled && (
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className="glass grid size-14 place-items-center rounded-2xl border">
            {fullscreen ? <Minimize /> : <Maximize />}
          </button>
        )}
      </div>
    </>
  );
}
