// Small stroke-currentColor icons used by the TabBar's tab + folder context
// menus and the Session / Tabs labels. They lived inline at the bottom of
// TabBar.tsx; pulled out here so that file stays focused on the tab strip's
// behaviour rather than its SVG vocabulary, mirroring context-menu-icons.tsx /
// table-icons.tsx / explorer-icons.tsx. No behaviour change. Colour comes from
// the parent via `currentColor`.

export function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="8" height="8" rx="1.25" />
      <path d="M5.5 13.5h6a1 1 0 0 0 1-1v-6" />
    </svg>
  );
}

export function TabLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="7.5" width="9" height="6" rx="1.25" />
      <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" />
    </svg>
  );
}

export function FolderMenuIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h4l1.25 1.5H14v6.5H2z" />
    </svg>
  );
}

export function FolderRemoveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h4l1.25 1.5H14v6.5H2z" />
      <path d="M6 9.5h4" />
    </svg>
  );
}

export function MoveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="7" height="9" rx="1.25" />
      <path d="M9.5 8.5h4.5" />
      <path d="M12 6.5l2 2-2 2" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2L3 6L7 10" />
    </svg>
  );
}

export function DiagramIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

// Tiny folder-tab-stack icon paired with the TABS label. Reads as
// "tabs of paper" — disambiguates the label from the canvas's own
// shape tooling at a glance.
export function TabsLabelIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4.5h3l1 1.25h5v4.25h-9z" />
      <path d="M3 4.5V3h3.25" />
    </svg>
  );
}

// Clock face — the Session timer rows.
export function SessionTabIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5V8.5L10 10M8 2.5V1" />
    </svg>
  );
}

export function ClearIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  );
}

// Magnifier - the global-search button on the right edge of the bar.
export function SearchGlyph() {
  return (
    <svg
      width="14"
      height="14"
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

// Keyboard - the shortcuts-dialog button.
export function KeyboardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5.5" width="16" height="10" rx="1.5" />
      <path d="M5 9h.01M8 9h.01M11 9h.01M14 9h.01M5 12.5h10" />
    </svg>
  );
}

// Lightbulb - the Tips button (spec/43).
export function TipsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 13.5a5 5 0 1 1 6 0 2.5 2.5 0 0 0-1 2v.5H8V15.5a2.5 2.5 0 0 0-1-2z" />
      <path d="M8 18.5h4" />
    </svg>
  );
}

export function GearIcon() {
  // Sliders silhouette (two horizontal sliders with a knob on each)
  // instead of the cog that previously sat here. The cog's 8 spokes
  // around a central circle read as a sun on most rendering sizes,
  // especially in dark mode where the stroke is light, which made
  // the Settings button look like an alternate dark-mode toggle.
  // The sliders glyph is the standard "settings" affordance in
  // modern UI kits (Heroicons, Lucide, Material) and reads as
  // "settings" without ambiguity.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="11" y2="6" />
      <line x1="16" y1="6" x2="17.5" y2="6" />
      <circle cx="13.5" cy="6" r="2" />
      <line x1="3" y1="14" x2="6" y2="14" />
      <line x1="11" y1="14" x2="17.5" y2="14" />
      <circle cx="8.5" cy="14" r="2" />
    </svg>
  );
}
