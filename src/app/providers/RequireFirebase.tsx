import { Outlet } from "react-router";
import { FirebaseSetupNotice } from "@/components/shared/FirebaseSetupNotice";
import { isFirebaseConfigured } from "@/services/firebase/config";

/** Route guard: role screens need Firebase; show setup instructions otherwise. */
export function RequireFirebase() {
  return isFirebaseConfigured ? <Outlet /> : <FirebaseSetupNotice />;
}
