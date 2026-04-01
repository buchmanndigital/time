/** Erlaubte Hosts für eingebettete Browser-Use-Live-Ansicht (Cloud). */
export function isTrustedBrowserUseLiveUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "browser-use.com" || h.endsWith(".browser-use.com");
  } catch {
    return false;
  }
}
