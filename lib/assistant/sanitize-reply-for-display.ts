/** UUID (v4-üblich), case-insensitive. */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * Entfernt technische IDs aus KI-Antworten für die Chat-Anzeige.
 * Tool-Aufrufe bleiben unverändert (laufen vor der finalen Textantwort).
 */
export function sanitizeAssistantReplyForDisplay(text: string): string {
  let s = text.replace(UUID_RE, "");

  s = s.replace(/\(\s*\)/g, "");
  s = s.replace(/\[\s*\]/g, "");
  s = s.replace(/,\s*,/g, ",");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n[ \t]+/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}
