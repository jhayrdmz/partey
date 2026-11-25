import { Settings2 } from "lucide-react";
import { missingConfigKeys } from "@/services/firebase/config";
import { ScreenState } from "./ScreenState";

/** Shown instead of role screens when Firebase env vars are missing. */
export function FirebaseSetupNotice() {
  return (
    <ScreenState
      icon={Settings2}
      title="Firebase isn't configured yet"
      message={
        <div className="space-y-3 text-left text-sm">
          <p>
            Copy <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> and fill in your Firebase web config, or set{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">VITE_USE_FIREBASE_EMULATORS=true</code> to use the local emulators.
          </p>
          <p>Missing: {missingConfigKeys.join(", ")}</p>
        </div>
      }
    />
  );
}
