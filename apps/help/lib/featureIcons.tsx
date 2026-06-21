import type { ReactNode } from 'react';

/** Feature slug → icon (full <svg>). Used by the home grid, the features
 *  index, and the MDX <Feature> cards. Outline glyphs at w-6 h-6,
 *  `currentColor` so the call site sets the hue (see featureColours.ts).
 *  Add an entry here when adding a feature landing page. Missing slugs fall
 *  back to the `the-canvas` icon at the call site. */
export function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

/** Shared stroke props for every outline glyph. Exported so sibling icon sets
 *  (see articleIcons.tsx) draw in the same weight without re-declaring it. */
export const iconStroke = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.5,
} as const;

const s = iconStroke;

export const FEATURE_ICONS: Record<string, ReactNode> = {
  // User Interface.
  'panel-layout': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M9 4v16M15 12h6" {...s} />
    </Glyph>
  ),
  toolbar: (
    <Glyph>
      <rect x="3" y="8" width="18" height="6" rx="2" {...s} />
      <path d="M7 11h.01M11 11h.01M15 11h.01" {...s} />
    </Glyph>
  ),
  'context-menus': (
    <Glyph>
      <rect x="5" y="3" width="14" height="18" rx="2" {...s} />
      <path d="M9 8h6M9 12h6M9 16h3" {...s} />
    </Glyph>
  ),
  'zoom-controls': (
    <Glyph>
      <circle cx="11" cy="11" r="7" {...s} />
      <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" {...s} />
    </Glyph>
  ),
  'tab-bar': (
    <Glyph>
      <path d="M3 8a2 2 0 012-2h4l1.5 2H21v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" {...s} />
    </Glyph>
  ),
  'quick-controls': (
    <Glyph>
      <circle cx="6" cy="18" r="3" {...s} />
      <path d="M14 14l7-7M14 7h7v7" {...s} />
    </Glyph>
  ),
  'the-canvas': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 9h18M8 4v5" {...s} />
    </Glyph>
  ),
  // Palette → Selection Modes.
  select: (
    <Glyph>
      <path d="M5 3l6 16 2.5-6.5L20 10 5 3z" {...s} />
    </Glyph>
  ),
  hand: (
    <Glyph>
      <path
        d="M8 11V5.5a1.5 1.5 0 013 0V10m0-.5V4.5a1.5 1.5 0 013 0V10m0-.5V6a1.5 1.5 0 013 0v6a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4a1.6 1.6 0 012.7-1.7L8 13"
        {...s}
      />
    </Glyph>
  ),
  eraser: (
    <Glyph>
      <path d="M4 14l6-6 7 7-4 4H8l-4-4a1 1 0 010-1.4z" {...s} />
      <path d="M10 8l6 6M9 19h11" {...s} />
    </Glyph>
  ),
  'format-painter': (
    <Glyph>
      <path d="M4 5a1 1 0 011-1h11a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1z" {...s} />
      <path d="M17 6h2a1 1 0 011 1v3a1 1 0 01-1 1h-6a1 1 0 00-1 1v2M11 15h2v6h-2z" {...s} />
    </Glyph>
  ),
  laser: (
    <Glyph>
      <circle cx="12" cy="12" r="2.5" {...s} />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
        {...s}
      />
    </Glyph>
  ),
  spotlight: (
    <Glyph>
      <path d="M9 3l3 7M15 3l-1 7M9.5 10h5l1.2 9a1 1 0 01-1 1.2H9.3a1 1 0 01-1-1.2z" {...s} />
    </Glyph>
  ),
  'isometric-mode': (
    <Glyph>
      <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" {...s} />
      <path d="M12 12l9-4M12 12v9M12 12L3 8" {...s} />
    </Glyph>
  ),
  // Palette → Elements.
  shapes: (
    <Glyph>
      <rect x="3" y="4" width="8" height="8" rx="1" {...s} />
      <circle cx="16.5" cy="16" r="4" {...s} />
      <path d="M14 4l5 5M19 4l-5 5" {...s} />
    </Glyph>
  ),
  arrows: (
    <Glyph>
      <path d="M3 12h15M14 7l5 5-5 5" {...s} />
    </Glyph>
  ),
  tools: (
    <Glyph>
      <path
        d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z"
        {...s}
      />
    </Glyph>
  ),
  components: (
    <Glyph>
      <rect x="3" y="3" width="7" height="7" rx="1" {...s} />
      <rect x="14" y="3" width="7" height="7" rx="1" {...s} />
      <rect x="3" y="14" width="7" height="7" rx="1" {...s} />
      <path d="M17.5 14v7M14 17.5h7" {...s} />
    </Glyph>
  ),
  devices: (
    <Glyph>
      <rect x="2" y="4" width="14" height="10" rx="1" {...s} />
      <path d="M2 17h12" {...s} />
      <rect x="17" y="9" width="5" height="11" rx="1" {...s} />
    </Glyph>
  ),
  icons: (
    <Glyph>
      <circle cx="12" cy="12" r="9" {...s} />
      <path d="M9.5 10a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5M12 17h.01" {...s} />
    </Glyph>
  ),
  drawing: (
    <Glyph>
      <path d="M3 17.5c2-6 5 3 7-1s4-7 11-9" {...s} />
      <path d="M16 4l4 1-1 4" {...s} />
    </Glyph>
  ),
  'selecting-and-grouping': (
    <Glyph>
      <path
        d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"
        {...s}
      />
      <rect x="9" y="9" width="6" height="6" rx="1" {...s} />
    </Glyph>
  ),
  'text-and-fonts': (
    <Glyph>
      <path d="M5 6V5h14v1M12 5v14M9 19h6" {...s} />
    </Glyph>
  ),
  themes: (
    <Glyph>
      <path
        d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 13 16 13h2a3 3 0 003-3c0-4-4.5-7-9-7z"
        {...s}
      />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  templates: (
    <Glyph>
      <rect x="3" y="3" width="18" height="18" rx="2" {...s} />
      <path d="M3 9h18M9 21V9" {...s} />
    </Glyph>
  ),
  'using-tabs': (
    <Glyph>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" {...s} />
    </Glyph>
  ),
  comments: (
    <Glyph>
      <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" {...s} />
    </Glyph>
  ),
  'live-presence': (
    <Glyph>
      <path d="M4 5l7 14 2.2-5.8L19 11 4 5z" {...s} />
      <circle cx="18" cy="6" r="2.5" {...s} />
    </Glyph>
  ),
  links: (
    <Glyph>
      <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" {...s} />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19" {...s} />
    </Glyph>
  ),
  images: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <circle cx="8.5" cy="9.5" r="1.5" {...s} />
      <path d="M21 16l-5-5L5 20" {...s} />
    </Glyph>
  ),
  'explorer-page': (
    <Glyph>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" {...s} />
    </Glyph>
  ),
  'explorer-panel': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M9 4v16" {...s} />
    </Glyph>
  ),
  teams: (
    <Glyph>
      <path
        d="M17 20v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 9a4 4 0 100-8 4 4 0 000 8zM23 20v-2a4 4 0 00-3-3.87M16 1.13a4 4 0 010 7.75"
        {...s}
      />
    </Glyph>
  ),
  sharing: (
    <Glyph>
      <circle cx="18" cy="5" r="3" {...s} />
      <circle cx="6" cy="12" r="3" {...s} />
      <circle cx="18" cy="19" r="3" {...s} />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" {...s} />
    </Glyph>
  ),
  'zen-mode': (
    <Glyph>
      <path d="M3 12h4l2 5 4-12 2 7h6" {...s} />
    </Glyph>
  ),
  ai: (
    <Glyph>
      <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" {...s} />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" {...s} />
    </Glyph>
  ),
  'markdown-import': (
    <Glyph>
      <rect x="3" y="6" width="18" height="12" rx="2" {...s} />
      <path d="M6 14V10l2 2 2-2v4M14 10v4M14 14l2-2M14 14l-2-2" {...s} />
    </Glyph>
  ),
  history: (
    <Glyph>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" {...s} />
      <path d="M3 4v4h4M12 8v4l3 2" {...s} />
    </Glyph>
  ),
  'session-tools': (
    <Glyph>
      <circle cx="12" cy="13" r="8" {...s} />
      <path d="M12 9v4l2 2M9 2h6" {...s} />
    </Glyph>
  ),
  'data-elements': (
    <Glyph>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...s} />
    </Glyph>
  ),
  'style-presets': (
    <Glyph>
      <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5L12 16l-5 2.7 1-5.5-4-3.9 5.5-.8L12 3z" {...s} />
    </Glyph>
  ),
  'layout-cleanup': (
    <Glyph>
      <rect x="3" y="3" width="7" height="7" rx="1" {...s} />
      <rect x="14" y="3" width="7" height="7" rx="1" {...s} />
      <rect x="3" y="14" width="7" height="7" rx="1" {...s} />
      <rect x="14" y="14" width="7" height="7" rx="1" {...s} />
    </Glyph>
  ),
  isometric: (
    <Glyph>
      <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" {...s} />
      <path d="M12 12l9-4M12 12v9M12 12L3 8" {...s} />
    </Glyph>
  ),
  annotations: (
    <Glyph>
      <circle cx="12" cy="12" r="9" {...s} />
      <path d="M12 8v4M12 16h.01" {...s} />
    </Glyph>
  ),
  technology: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M9 4v16M15 4v16M4 9h16M4 15h16" {...s} />
    </Glyph>
  ),
  // Palette → Palette Settings.
  'auto-attach-arrows': (
    <Glyph>
      <rect x="3" y="9" width="6" height="6" rx="1" {...s} />
      <rect x="15" y="9" width="6" height="6" rx="1" {...s} />
      <path d="M9 12h6M13 10l2 2-2 2" {...s} />
    </Glyph>
  ),
  'alignment-guides': (
    <Glyph>
      <path d="M12 3v18" {...s} />
      <rect x="4" y="6" width="6" height="4" rx="1" {...s} />
      <rect x="14" y="14" width="6" height="4" rx="1" {...s} />
    </Glyph>
  ),
  'minimal-panels': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 8h18M6 14h4M6 17h7" {...s} />
    </Glyph>
  ),
  'reset-palette-position': (
    <Glyph>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" {...s} />
      <path d="M3 4v4h4" {...s} />
      <rect x="14" y="4" width="6" height="6" rx="1" {...s} />
    </Glyph>
  ),
  // Explorer section guides.
  recent: (
    <Glyph>
      <circle cx="12" cy="12" r="9" {...s} />
      <path d="M12 7v5l3 2" {...s} />
    </Glyph>
  ),
  'shared-with-you': (
    <Glyph>
      <circle cx="6" cy="12" r="2.5" {...s} />
      <circle cx="17" cy="6.5" r="2.5" {...s} />
      <circle cx="17" cy="17.5" r="2.5" {...s} />
      <path d="M8.2 10.8l6.6-3.4M8.2 13.2l6.6 3.4" {...s} />
    </Glyph>
  ),
  'my-work': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...s} />
    </Glyph>
  ),
  'team-spaces': (
    <Glyph>
      <circle cx="9" cy="9" r="3" {...s} />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...s} />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17 19a5.5 5.5 0 0 0-3-4.9" {...s} />
    </Glyph>
  ),
  'image-gallery': (
    <Glyph>
      <rect x="3" y="5" width="18" height="14" rx="2" {...s} />
      <circle cx="8.5" cy="10" r="1.5" {...s} />
      <path d="M21 16l-5-5-7 7" {...s} />
    </Glyph>
  ),
  'themes-library': (
    <Glyph>
      <circle cx="13.5" cy="6.5" r=".8" {...s} />
      <circle cx="17.5" cy="10.5" r=".8" {...s} />
      <circle cx="8.5" cy="7.5" r=".8" {...s} />
      <circle cx="6.5" cy="12.5" r=".8" {...s} />
      <path
        d="M12 3a9 9 0 1 0 0 18c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.6H16a5 5 0 0 0 5-5C21 6 16.9 3 12 3z"
        {...s}
      />
    </Glyph>
  ),
  // Tabs guides.
  'tab-folders': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...s} />
      <path d="M3 11h18" {...s} />
    </Glyph>
  ),
  'linking-tabs': (
    <Glyph>
      <path d="M10 13a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.3 1.3" {...s} />
      <path d="M14 11a4 4 0 0 0-5.7-.3L5.7 13.3a4 4 0 0 0 5.7 5.7l1.3-1.3" {...s} />
    </Glyph>
  ),
  'add-to-diagram': (
    <Glyph>
      <rect x="3" y="3" width="12" height="12" rx="2" {...s} />
      <path d="M9 21h10a2 2 0 0 0 2-2V9" {...s} />
      <path d="M17 13v4M15 15h4" {...s} />
    </Glyph>
  ),
  'import-tabs': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M12 3v9M9 9l3 3 3-3" {...s} />
    </Glyph>
  ),
  'export-tabs': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M12 14V4M9 7l3-3 3 3" {...s} />
    </Glyph>
  ),
  'tab-cleanup': (
    <Glyph>
      <path d="M3 21l6-6" {...s} />
      <path d="M9 9l6 6 5-5a3 3 0 0 0-4-4z" {...s} />
      <path d="M14 6l4 4" {...s} />
    </Glyph>
  ),
  // Search Panel guide.
  'the-search-panel': (
    <Glyph>
      <circle cx="11" cy="11" r="7" {...s} />
      <path d="M16 16l5 5" {...s} />
    </Glyph>
  ),
  // Light/dark mode guide.
  'dark-mode': (
    <Glyph>
      <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" {...s} />
    </Glyph>
  ),
};
