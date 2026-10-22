// A HYPERLINK's target (docs/specs/029-sheets/formulas.md "Text"; blueprint sheets-engine.md): kept only when it is an
// http, https or mailto address of a sane length, so a `javascript:` or `data:` target typed into a formula, or one
// arriving in an imported CSV, can never be opened. Anything else draws the label as plain text.

// The longest target kept: well past any real address, short of a smuggled payload.
export const HYPERLINK_URL_MAX = 2048;

const SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export function safeHyperlink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!url || url.length > HYPERLINK_URL_MAX) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return SCHEMES.has(parsed.protocol) ? parsed.href : null;
}
