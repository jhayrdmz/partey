import { Outlet, ScrollRestoration } from "react-router";
import { AppProviders } from "../providers/AppProviders";

export function RootLayout() {
  return (
    <AppProviders>
      <Outlet />
      <ScrollRestoration />
    </AppProviders>
  );
}
