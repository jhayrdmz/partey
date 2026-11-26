import { createBrowserRouter, RouterProvider } from "react-router";
import { RootLayout } from "./RootLayout";
import { RouteError } from "./RouteError";
import { RequireFirebase } from "../providers/RequireFirebase";
import { LandingScreen } from "@/features/landing/LandingScreen";
import { LoadingScreen } from "@/components/shared/ScreenState";

/**
 * Role screens are lazy-loaded so a player's phone only downloads the player
 * bundle, and the TV only downloads the display bundle.
 */
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      { path: "/", element: <LandingScreen /> },
      // Static guide + FAQ: no Firebase needed.
      { path: "/how-it-works", lazy: async () => ({ Component: (await import("@/features/info/HowItWorksScreen")).HowItWorksScreen }) },
      {
        element: <RequireFirebase />,
        children: [
          { path: "/host", lazy: async () => ({ Component: (await import("@/features/host/screens/CreateRoomScreen")).CreateRoomScreen }) },
          // Opened by scanning a display's QR code (static segment outranks /host/:roomId).
          { path: "/host/pair/:code", lazy: async () => ({ Component: (await import("@/features/host/screens/HostPairScreen")).HostPairScreen }) },
          {
            path: "/host/:roomId",
            lazy: async () => ({ Component: (await import("@/features/host/HostRoomLayout")).HostRoomLayout }),
            children: [
              { index: true, lazy: async () => ({ Component: (await import("@/features/host/screens/HostLobbyScreen")).HostLobbyScreen }) },
              { path: "mode", lazy: async () => ({ Component: (await import("@/features/host/screens/ModeSelectScreen")).ModeSelectScreen }) },
              { path: "games", lazy: async () => ({ Component: (await import("@/features/host/screens/GameSelectScreen")).GameSelectScreen }) },
            ],
          },
          { path: "/play", lazy: async () => ({ Component: (await import("@/features/player/screens/EnterCodeScreen")).EnterCodeScreen }) },
          { path: "/play/:roomCode", lazy: async () => ({ Component: (await import("@/features/player/screens/PlayerScreen")).PlayerScreen }) },
          { path: "/display", lazy: async () => ({ Component: (await import("@/features/display/screens/DisplayPairScreen")).DisplayPairScreen }) },
          { path: "/display/:roomId", lazy: async () => ({ Component: (await import("@/features/display/screens/DisplayRoomScreen")).DisplayRoomScreen }) },
        ],
      },
      { path: "*", element: <RouteError /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
