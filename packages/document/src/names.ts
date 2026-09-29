// Tab + diagram name length (docs/specs/006-document/name-length.md).
//
// Names had no cap. Mostly invisible when you type one by hand, but the
// editor also AUTO-NAMES a tab and diagram from the first element's label
// (docs/specs/006-document/document-structure.md) — so pasting a paragraph into the welcome rectangle made the
// whole paragraph the diagram's name, which then had to be rendered in the
// header, the browser tab title, the Explorer list and every share surface.
//
// One helper, applied at every entry point, so a name can't arrive over-long
// from any direction (auto-naming, manual rename, import, API).

// 60 characters. The issue that prompted this suggested 40-60; 60 is the top
// of that range, which keeps real titles ("Q3 platform migration — phase 2
// rollout") intact while still fitting a tab pill and a browser tab title.
// Counted in code points, not UTF-16 units, so an emoji or accented
// character costs one the way a reader would count it.
export const NAME_MAX_LENGTH = 60;

// Trim a name to NAME_MAX_LENGTH, breaking at a WORD boundary and marking
// the cut with an ellipsis. Word-boundary because a mid-word chop reads as
// corruption ("Quarterly platform migra…") where a whole-word one reads as
// a summary.
//
// Also collapses whitespace: an auto-name derived from a pasted block would
// otherwise carry newlines and runs of spaces into a single-line title.
export function truncateName(raw: string): string {
  const collapsed = raw.replace(/\s+/gu, ' ').trim();
  const chars = [...collapsed];
  if (chars.length <= NAME_MAX_LENGTH) return collapsed;
  // One char short of the cap so the ellipsis fits inside the budget.
  const clipped = chars.slice(0, NAME_MAX_LENGTH - 1).join('');
  const lastSpace = clipped.lastIndexOf(' ');
  // Only honour the word boundary if it leaves something worth reading —
  // a very long first word (a URL, a hash) would otherwise truncate to
  // nearly nothing, where a hard cut at least shows its opening.
  const body = lastSpace > NAME_MAX_LENGTH / 3 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.trimEnd()}…`;
}

// Up to two characters for a person's avatar. Single-word names use the first
// two letters; multi-word names use the first letter of the first and last
// word ("Curious Falcon" -> "CF"). Here rather than in the editor so the
// headless export draws the same initials the canvas does (a Roll call's
// people, docs/specs/020-import-export/export-fidelity.md).
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
