import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2 } from "lucide-react";
import { pairingCodeFromQr } from "@/utils/urls";

/**
 * Live camera scanner for a display's pairing QR. Calls `onCode` once with the code.
 * qr-scanner is loaded on demand so it isn't part of the lobby bundle; it uses the native
 * BarcodeDetector where available and its own decoder elsewhere (e.g. iOS Safari).
 */
export function DisplayQrScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop(): void; destroy(): void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;
        const instance = new QrScanner(
          videoRef.current,
          (result) => {
            if (done.current) return;
            const code = pairingCodeFromQr(result.data);
            if (!code) {
              setHint("That's not a display code. Scan the QR on the TV's pairing screen.");
              return;
            }
            done.current = true;
            instance.stop();
            onCode(code);
          },
          { preferredCamera: "environment", maxScansPerSecond: 8, highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
        );
        scanner = instance;
        await instance.start();
        if (!cancelled) setState("scanning");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? String(err);
        setError(
          /NotAllowed|Permission/i.test(name) || /permission|denied/i.test(String(err))
            ? "Camera access is blocked. Allow it in your browser settings, or type the code instead."
            : "Couldn't open a camera on this device. Type the code shown on the display instead.",
        );
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onCode]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label="Camera preview" />
        {state === "starting" && (
          <div className="absolute inset-0 grid place-items-center text-white/80" role="status">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="size-5 animate-spin" /> Opening camera…
            </span>
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center" role="alert">
            <span className="flex flex-col items-center gap-3 text-sm font-semibold text-white/90">
              <CameraOff className="size-8 text-white/70" /> {error}
            </span>
          </div>
        )}
      </div>
      <p className="min-h-5 text-center text-sm text-muted-foreground" aria-live="polite">
        {hint ?? (state === "scanning" ? "Point the camera at the QR code on the TV." : "")}
      </p>
    </div>
  );
}
