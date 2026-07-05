// Small stroke-currentColor icons used exclusively by the table editor
// (TableView): the row/column move arrows, the menu-trigger chevron, the cell
// text-align glyph, the delete-row/column trash, and the cell-link glyph. They
// lived inline at the top of TableView.tsx; pulled out here so that file stays
// focused on the table's behaviour rather than its SVG vocabulary, mirroring
// context-menu-icons.tsx / explorer-icons.tsx. No behaviour change. Colour
// comes from the parent via `currentColor`.

export function ArrowIcon({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const d = {
    left: 'M11 7H3M3 7l3-3M3 7l3 3',
    right: 'M3 7h8M11 7l-3-3M11 7l-3 3',
    up: 'M7 11V3M7 3l3 3M7 3l-3 3',
    down: 'M7 3v8M7 11l-3-3M7 11l3-3',
  }[dir];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
      <path
        d="M1.5 3l2.5 2.5L6.5 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlignIcon({ dir }: { dir: 'left' | 'center' | 'right' }) {
  const lines =
    dir === 'left'
      ? ['M2 4h10', 'M2 7h6', 'M2 10h8']
      : dir === 'right'
        ? ['M2 4h10', 'M6 7h6', 'M4 10h8']
        : ['M2 4h10', 'M4 7h6', 'M3 10h8'];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {lines.map((d, i) => (
        <path key={i} d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 4h8M5.5 4V2.8h3V4M4 4l.4 7.2h5.2L10 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The element-link chain glyph (spec/09 links), shared with the context
// menu's Link tile so the two linking surfaces can't drift.
export { LinkMenuIcon as CellLinkIcon } from '@/components/palette/context-menu-icons';
