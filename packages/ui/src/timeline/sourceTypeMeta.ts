// Per-source-type display metadata (spec/138 §7).
//
// One place decides what a source type is called, what colour it is,
// and which glyph it wears, so the bubble, the filter chip, and the
// calendar dot can never disagree about a kind.
//
// Colour comes from CSS variables the consuming app defines, with a
// hard-coded fallback baked in here. Two reasons for the indirection:
// the app themes light and dark differently (this product has a
// class-based dark mode, so every tint needs two values), and an
// unmapped source type still has to render as SOMETHING rather than
// disappear into a transparent bubble.

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  diagram: 'Diagrams',
  team: 'Teams',
  account: 'Account',
};

// Fallback pairs, used when the app hasn't defined the CSS variable.
// `bold` paints the icon and the calendar dot; `soft` paints the
// bubble background. The soft values are deliberately low-alpha rather
// than opaque tints so one set works over both a white and a slate
// surface.
const FALLBACK: Record<string, { bold: string; soft: string }> = {
  diagram: { bold: '#0ea5e9', soft: 'rgba(14, 165, 233, 0.10)' },
  team: { bold: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.10)' },
  account: { bold: '#f59e0b', soft: 'rgba(245, 158, 11, 0.10)' },
};

const NEUTRAL = { bold: '#64748b', soft: 'rgba(100, 116, 139, 0.10)' };

export function sourceTypeLabel(sourceType: string): string {
  const mapped = SOURCE_TYPE_LABELS[sourceType];
  if (mapped) return mapped;
  // Title-case the raw value so a source type shipped by a newer
  // worker reads as a proper noun rather than looking broken.
  return sourceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sourceTypeColor(sourceType: string): string {
  const fallback = FALLBACK[sourceType] ?? NEUTRAL;
  return `var(--ld-timeline-${sourceType}, ${fallback.bold})`;
}

export function sourceTypeSoftColor(sourceType: string): string {
  const fallback = FALLBACK[sourceType] ?? NEUTRAL;
  return `var(--ld-timeline-${sourceType}-soft, ${fallback.soft})`;
}

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
// type from a newer worker renders a bubble that simply looks plain
// rather than one with a hole where its icon should be.
const FALLBACK_PATH = 'M12 6a6 6 0 100 12 6 6 0 000-12z';

export function sourceTypeIconPath(sourceType: string): string {
  return ICON_PATHS[sourceType] ?? FALLBACK_PATH;
}
