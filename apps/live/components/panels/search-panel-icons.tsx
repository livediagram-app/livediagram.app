import type { SearchResultItem } from '@/lib/search';

// The search panel's result-kind glyphs (spec/09 Search panel), lifted
// out of SearchPanel: a compact icon per result kind so users can scan
// the list by shape without reading labels, plus the input's magnifier.

export function SearchResultIcon({ item }: { item: SearchResultItem }) {
  // Compact glyph per result kind so users can scan the list by
  // shape without reading labels.
  const stroke = 'currentColor';
  if (item.kind === 'shared') {
    // Diagram rect + an inbound arrow: someone else's diagram that
    // was shared into this account.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <rect x="5" y="5" width="8" height="8" rx="1.5" />
        <path d="M2 2l4 4M6 3v3h-3" />
      </svg>
    );
  }
  if (item.kind === 'team') {
    // Two heads: a team.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="6" cy="6" r="2.2" />
        <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
        <circle cx="11.5" cy="6.5" r="1.8" />
        <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
      </svg>
    );
  }
  if (item.kind === 'diagram') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <rect x="3" y="3" width="10" height="10" rx="1.5" />
      </svg>
    );
  }
  if (item.kind === 'folder') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M2.5 4.5h4l1.5 1.5h5.5v6.5a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z" />
      </svg>
    );
  }
  if (item.kind === 'tab') {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M2.5 6.5h4l1-2h6v9h-11z" />
      </svg>
    );
  }
  if (item.kind === 'palette') {
    // Plus-in-a-box: this result ADDS an element rather than navigating.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        aria-hidden
      >
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
        <path d="M8 5.5v5M5.5 8h5" />
      </svg>
    );
  }
  if (item.kind === 'command') {
    // Lightning bolt: a do-something command (delete / lock / rotate / share
    // / rename / ...) rather than navigation, distinct from the palette's
    // plus-in-a-box add glyph.
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8.5 1.5 3 9h4l-.5 5.5L13 7H9z" />
      </svg>
    );
  }
  if (item.kind === 'help') {
    // A "?" in a circle: a help-centre article (opens in a new tab).
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.5-.7 1v.3" />
        <path d="M8 11.4h.01" />
      </svg>
    );
  }
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      aria-hidden
    >
      <circle cx="8" cy="8" r="4" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}
