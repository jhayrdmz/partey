/** Public base URL for join links/QR codes (override with VITE_PUBLIC_APP_URL for LAN/TV setups). */
export function appBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return window.location.origin;
}

export function joinUrl(roomCode: string): string {
  return `${appBaseUrl()}/play/${roomCode}`;
}

/** "partey.app/play" style short label for on-screen instructions. */
export function joinUrlLabel(): string {
  return `${appBaseUrl().replace(/^https?:\/\//, "")}/play`;
}

/** Opened by the host's phone when it scans the QR on a display: connects that display to the host's room. */
export function displayPairUrl(code: string): string {
  return `${appBaseUrl()}/host/pair/${code}`;
}

/** "partey.app/display" style short label for on-screen instructions. */
export function displayUrlLabel(): string {
  return `${appBaseUrl().replace(/^https?:\/\//, "")}/display`;
}
