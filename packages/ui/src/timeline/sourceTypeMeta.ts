// Per-source-type display metadata (docs/specs/013-workspace/timeline.md §7).
//
// One place decides which glyph a source type wears, so the card and
// the calendar dot can never disagree about a kind.
//
// Colour is NOT here: it keys on what happened, not on where it
// happened, and lives in eventTone.ts. Labels aren't here either —
// filtering reads categories, not source types (eventCategory.ts), so
// what remains is the glyph for a source the host app hasn't drawn.

// Heroicons-style 24px outline paths, one per source type. Kept as raw
// path data rather than components so the calendar's dots can drop the
// same shape into their own tiny SVG without mounting a component per
// cell.
const ICON_PATHS: Record<string, string> = {
  diagram:
    'M4 5a1 1 0 011-1h5a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm9 10a1 1 0 011-1h5a1 1 0 011 1v4a1 1 0 01-1 1h-5a1 1 0 01-1-1v-4zM11 7h4a2 2 0 012 2v5',
  team: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  account:
    'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
};

// A generic dot for anything unmapped — never null, so a new source
// type from a newer worker renders a card that simply looks plain
// rather than one with a hole where its icon should be.
const FALLBACK_PATH = 'M12 6a6 6 0 100 12 6 6 0 000-12z';

export function sourceTypeIconPath(sourceType: string): string {
  return ICON_PATHS[sourceType] ?? FALLBACK_PATH;
}
