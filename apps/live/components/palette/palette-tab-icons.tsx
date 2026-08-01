// The palette category-tab glyphs (spec/09), lifted out of
// CommandPalette's tab definitions so the palette file reads as wiring
// rather than ~180 lines of inline SVG. Each is the universal symbol
// for its category, readable at tab size.

export function FavouritesTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* A star — the universal favourites mark (the Icons tab
            deliberately uses a smiley instead, so no clash). */}
      <path d="M12 3.2l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 17.45 6.6 19.83l1.03-6.02L3.26 9.55l6.04-.88z" />
    </svg>
  );
}

export function ShapesTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Three distinct shapes (triangle + circle + square)
            in a little cluster: the universal "shapes" symbol,
            readable at a glance. */}
      <path d="M9 2 12.3 7.4 5.7 7.4Z" />
      <circle cx="5.2" cy="12.8" r="2.8" />
      <rect x="10.4" y="10" width="5.6" height="5.6" rx="0.9" />
    </svg>
  );
}

// Build (spec/132): a frame with a band across its top and a node hanging off
// it — scaffolding rather than content, which is what this category holds.
export function BuildTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1.6" y="3" width="9.4" height="12" rx="1.2" />
      <path d="M1.6 6.6h9.4" />
      <path d="M11 10.8h2.2" />
      <rect x="13.2" y="8.6" width="3.2" height="4.4" rx="0.9" />
    </svg>
  );
}

export function ComponentsTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Stacked blocks — a header bar over a content block — reading
              as "pre-assembled section". */}
      <rect x="2.5" y="2.5" width="13" height="4" rx="1" />
      <rect x="2.5" y="8" width="13" height="7.5" rx="1" />
    </svg>
  );
}

// The Data category's glyph (spec/53): a bar chart, the most literal picture
// of what the tab holds.
export function DataTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 20V10M12 20V4M19 20v-8" />
    </svg>
  );
}

// The Behaviour category's glyph (spec/110): a cursor over a target, for the
// elements that DO something when somebody interacts with them.
export function BehaviourTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4l6.5 16 2.3-6.6 6.7-2.4z" />
      <path d="M14.5 14.5 20 20" />
    </svg>
  );
}

// The Collaborate category's glyph (spec/123 to spec/129): raised hands over a
// board, for the elements that collect an answer from the whole room rather
// than showing what one author drew.
export function CollaborateTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8.5" cy="7" r="3" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M3 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15 19a4.4 4.4 0 0 1 6-3.8" />
    </svg>
  );
}

// The Write category's glyph (spec/110): a pen nib over a line of text.
export function WriteTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7.5 18.5 3 20l1.5-4.5z" />
      <path d="m14.5 5.5 4 4" />
    </svg>
  );
}

// The Draw category's glyph (spec/110): a freehand squiggle.
export function DrawTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 16c3-6 5.5-9 7-9s1.5 4 0 8 1 5 3.5 2 4.5-6 7.5-6" />
    </svg>
  );
}

// The Media category's glyph (spec/110): a picture frame, for Image + Avatar.
export function MediaTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 16.5 4.5-4 3.5 3 3-2.5 5 4" />
    </svg>
  );
}

export function DevicesTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="13" height="9" rx="1" />
      <path d="M6.5 15h5M9 12v3" />
    </svg>
  );
}

export function IconsTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* A smiley glyph reads as "pick an icon" more clearly
            than a star (which implies favourites). */}
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.4 14.5s1.4 1.9 3.6 1.9 3.6-1.9 3.6-1.9" />
      <path d="M9 9.5h.01" />
      <path d="M15 9.5h.01" />
    </svg>
  );
}

export function StickersTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* A die-cut sticker: a rounded square with its bottom-right
            corner peeled back. The universal "sticker" mark, and
            unmistakable next to the Icons tab's smiley. */}
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V14l-6 7H6.5A2.5 2.5 0 0 1 4 18.5z" />
      <path d="M20 14h-4a2 2 0 0 0-2 2v5" />
    </svg>
  );
}

export function TechTabIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Stacked servers / racks: the universal "infrastructure"
            mark, distinct from the smiley used for line-art icons. */}
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </svg>
  );
}
