// The palette category-tab glyphs (spec/09), lifted out of
// CommandPalette's tab definitions so the palette file reads as wiring
// rather than ~180 lines of inline SVG. Each is the universal symbol
// for its category, readable at tab size.

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

export function ToolsTabIcon() {
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
      {/* Lucide-style wrench: a clean, instantly-readable
            "tools" glyph. */}
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
