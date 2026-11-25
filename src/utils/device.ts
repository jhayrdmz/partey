/** Friendly default name for a display, e.g. "Chrome on Android TV". */
export function defaultDisplayLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android TV|AFT|BRAVIA|SMART-TV|SmartTV|Tizen|webOS/i.test(ua)
    ? "Smart TV"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Mac/i.test(ua)
          ? "Mac"
          : /Windows/i.test(ua)
            ? "Windows"
            : /Linux/i.test(ua)
              ? "Linux"
              : "Display";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return browser ? `${browser} on ${os}` : os;
}
