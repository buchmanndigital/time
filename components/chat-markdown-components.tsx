import type { Components } from "react-markdown";

/** Installierte App (Safari Web App, Chrome/Edge PWA, iOS „Zum Home-Bildschirm“). */
function isInstalledDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function unsafeHref(href: string): boolean {
  const t = href.trim().toLowerCase();
  return t.startsWith("javascript:") || t.startsWith("data:");
}

/**
 * Links im Chat: immer neuer Kontext (target=_blank).
 * In installierter App zusätzlich window.open, damit nicht die gesamte PWA durch Navigation ersetzt wird
 * und externe Seiten im normalen Browser-Tab landen (Browser-abhängig).
 */
export const CHAT_MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => {
    if (!href || typeof href !== "string" || unsafeHref(href)) {
      return <span>{children}</span>;
    }
    const isMailto = href.trim().toLowerCase().startsWith("mailto:");

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (isMailto) return;
          if (!isInstalledDisplayMode()) return;
          e.preventDefault();
          let url = href;
          try {
            if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
              url = new URL(href, window.location.origin).href;
            } else if (href.startsWith("//")) {
              url = `${window.location.protocol}${href}`;
            }
          } catch {
            return;
          }
          window.open(url, "_blank", "noopener,noreferrer");
        }}
      >
        {children}
      </a>
    );
  },
};
