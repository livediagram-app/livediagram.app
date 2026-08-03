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

/** Behaviour → Selection Mode: a pointer, the thing being switched. */
export function ModeGroupIcon() {
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
      <path d="M5.5 3.5 18 11.2l-5.2 1.4-2.1 5.6z" />
    </svg>
  );
}

/** Behaviour → Get around: an arrow through a doorway. */
export function MoveGroupIcon() {
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
      <path d="M4 20V6.5a1 1 0 0 1 .8-1l7-1.4a1 1 0 0 1 1.2 1V20" />
      <path d="M2.6 20h12.8M17 9.5h4.4M19.2 7.3l2.2 2.2-2.2 2.2" />
    </svg>
  );
}

/** Behaviour → Run the room: a raised hand over a card. */
export function FacilitateGroupIcon() {
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
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20h8M12 16.5V20M9 11.5V8.2M12 11.5V7M15 11.5v-2.6" />
    </svg>
  );
}

/** Collaborate → Ask the room: a question mark in a bubble. */
export function AskGroupIcon() {
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
      <path d="M20.5 11.6c0 3.8-3.8 6.9-8.5 6.9-.9 0-1.8-.1-2.6-.3l-5 3.1 1.1-4.5A6.5 6.5 0 0 1 3.5 11.6c0-3.8 3.8-6.9 8.5-6.9s8.5 3.1 8.5 6.9z" />
      <path d="M10.2 9.4a1.9 1.9 0 1 1 2.4 2.2c-.5.2-.8.6-.8 1.1M12 15h.01" />
    </svg>
  );
}

/** Collaborate → Keep a record: a page with ruled lines. */
export function RecordGroupIcon() {
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
      <path d="M6 2.6h8l4.4 4.4V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1z" />
      <path d="M13.8 2.6V7h4.4M8.4 12h7.2M8.4 16h5" />
    </svg>
  );
}
