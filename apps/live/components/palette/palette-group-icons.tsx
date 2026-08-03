// Glyphs for the collapsible tile groups inside a palette category
// (PaletteTileGroup). Kept beside the tab icons rather than inline in the tab
// bodies, so the category files stay a list of what's in them.

/** Media → Embed: a framed play triangle. */
export function EmbedGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8h19" />
      <path d="M10.5 12.2v3.6l3.2-1.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Components → Web Elements: a page with a header band and stacked sections. */
export function WebGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M3 8h18" />
      <rect x="6" y="11" width="12" height="3.5" rx="1" fill="currentColor" stroke="none" />
      <path d="M6 17.5h7" />
    </svg>
  );
}

/** Behaviour → Session: a clock face, the shared thread through timer / vote / poll. */
export function SessionGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.6 1.6M9.4 3.2h5.2" />
    </svg>
  );
}

/** Behaviour → Reactions: a burst, which is what every one of them throws. */
export function ReactionGroupIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2M6 6l2.3 2.3M15.7 15.7 18 18M18 6l-2.3 2.3M8.3 15.7 6 18" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
