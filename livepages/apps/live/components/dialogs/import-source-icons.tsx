// Import sources' icons (docs/specs/013-workspace/folders.md "Import from"): art, painted, like the
// export format icons. Original glyphs only: the repo ships no vendor trademark marks.

/**
 * Microsoft Whiteboard's button: an original glyph (a whiteboard with a drawn stroke on a blue
 * tile), not Microsoft's logo; the repo ships no vendor trademark marks
 * (docs/specs/004-interface-design/iconography.md).
 */
export function MsWhiteboardSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#2b6fd6" />
      <rect
        x="4.5"
        y="5"
        width="11"
        height="8.5"
        rx="1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
      />
      <path
        d="M6.3 11c1-2.2 2-2.2 2.6-.7s1.6 1.5 2.5-.4 1.6-1.6 2.3-.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 13.5v2.2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Excalidraw's button: an original glyph (a hand-drawn box and a pencil on a violet tile), not
 * Excalidraw's logo; the repo ships no vendor trademark marks
 * (docs/specs/004-interface-design/iconography.md).
 */
export function ExcalidrawSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#6965db" />
      <path
        d="M4.6 6.2c2-.4 4.2-.5 6.3-.3M4.8 6c-.2 2-.1 4.1.1 6.1M5 12.2c1.8.2 3.6.2 5.3 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M10.6 14.6l1-2.9 4.2-4.2a1.1 1.1 0 0 1 1.6 1.6l-4.2 4.2z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * draw.io's button: an original glyph (a box joined by an elbow connector to a decision diamond on
 * a deep orange tile), not draw.io's logo; the repo ships no vendor trademark marks
 * (docs/specs/004-interface-design/iconography.md).
 */
export function DrawioSourceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden focusable="false">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#c2410c" />
      <rect
        x="3.8"
        y="4.2"
        width="6.4"
        height="4.2"
        rx="0.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.3"
      />
      <path d="M7 8.4v4.4h3.4" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M13.4 10.2l2.6 2.6-2.6 2.6-2.6-2.6z" fill="#fff" />
    </svg>
  );
}
