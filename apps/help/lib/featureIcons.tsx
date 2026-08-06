import { topCategorySlug } from '@livediagram/help-registry';
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
  // The element families the Build / Write / Collaborate / Behaviour tabs
  // hold. Each one draws the thing it makes, so the tab reads before the label
  // does — the whole reason these tiles exist.
  write: (
    <Glyph>
      <path d="M4 20l1-4 9.5-9.5a2 2 0 012.8 2.8L8 18.8z" {...s} />
      <path d="M13 7.5l3.5 3.5" {...s} />
    </Glyph>
  ),
  build: (
    <Glyph>
      <rect x="3" y="13" width="8" height="7" rx="1" {...s} />
      <rect x="13" y="13" width="8" height="7" rx="1" {...s} />
      <rect x="8" y="4" width="8" height="7" rx="1" {...s} />
    </Glyph>
  ),
  'mind-maps': (
    <Glyph>
      <circle cx="5.5" cy="12" r="2.5" {...s} />
      <circle cx="18.5" cy="6" r="2.5" {...s} />
      <circle cx="18.5" cy="12" r="2.5" {...s} />
      <circle cx="18.5" cy="18" r="2.5" {...s} />
      <path d="M8 11l8-4M8 12h8M8 13l8 4" {...s} />
    </Glyph>
  ),
  // Two bubbles rather than two people: the Collaborate tiles are the things
  // a group leaves on the canvas, not the people leaving them (the
  // Collaboration category owns that glyph).
  collaborate: (
    <Glyph>
      <path
        d="M3 6.5A1.5 1.5 0 014.5 5h9A1.5 1.5 0 0115 6.5v4A1.5 1.5 0 0113.5 12H8l-3 3v-3H4.5A1.5 1.5 0 013 10.5z"
        {...s}
      />
      <path d="M18 9h1.5A1.5 1.5 0 0121 10.5v4A1.5 1.5 0 0119.5 16H19v3l-3-3h-3" {...s} />
    </Glyph>
  ),
  // A chair in profile: back, seat, two legs. Drawn side-on because a front-on
  // chair is a rectangle on sticks, which reads as a table.
  chairs: (
    <Glyph>
      <rect x="7" y="3.5" width="10" height="9" rx="2" {...s} />
      <path d="M5 15h14" {...s} />
      <path d="M8 15v5.5M16 15v5.5" {...s} />
    </Glyph>
  ),
  lanes: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 9.5h18M3 15h18" {...s} />
      <path d="M6.5 4v16" {...s} />
    </Glyph>
  ),
  entities: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M4 8.5h16" {...s} />
      <path d="M7.5 12h9M7.5 16h9" {...s} />
    </Glyph>
  ),
  'embed-elements': (
    <Glyph>
      <rect x="3" y="5" width="18" height="14" rx="2" {...s} />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" {...s} />
    </Glyph>
  ),
  // A pressable pill with the pointer arriving from outside it: every Behaviour
  // element is something a participant activates rather than reads. The pointer
  // sits clear of the pill — overlapping the two made one shape nobody could
  // read as either.
  behaviour: (
    <Glyph>
      <rect x="3" y="5" width="14" height="7" rx="3.5" {...s} />
      <path d="M6.5 8.5h7" {...s} />
      <path d="M13 15l6.5 2.5-2.8.9-.9 2.8z" {...s} />
    </Glyph>
  ),
  // A die-cut plate: the outer cut line, the white margin inside it, and a motif
  // on the plate. Deliberately NOT a folded corner — that idiom already means a
  // document here (`document`, `page`), and a sticker is the opposite of a page.
  stickers: (
    <Glyph>
      <rect x="3" y="3" width="18" height="18" rx="5" {...s} />
      <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" {...s} />
      <path d="M12 9l1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" {...s} />
    </Glyph>
  ),
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
  // Palette → Behaviour elements. Every one of these is, physically, a button
  // someone presses, and the `behaviour` family glyph above already draws that.
  // So none of them draws a button being pressed: each draws what pressing it
  // DOES, which is the only thing that tells them apart.
  'mode-buttons': (
    <Glyph>
      <rect x="3" y="14" width="18" height="7" rx="3.5" {...s} />
      <path d="M12 11.5V6.5" {...s} />
      <path d="M9.5 9l2.5-2.5L14.5 9" {...s} />
      <path d="M17 3l4.5 2.5-1.9.7-.6 1.9z" {...s} />
    </Glyph>
  ),
  // A play triangle: this is the button that starts something for the room.
  'session-buttons': (
    <Glyph>
      <rect x="2.5" y="7" width="19" height="10" rx="5" {...s} />
      <path d="M10 9.8l4.5 2.2-4.5 2.2z" {...s} />
    </Glyph>
  ),
  // The tick, and the two you are still waiting on.
  'done-checks': (
    <Glyph>
      <circle cx="8" cy="8" r="5" {...s} />
      <path d="M5.8 8l1.6 1.6L10.3 6" {...s} />
      <circle cx="6.5" cy="16.5" r="1.5" {...s} />
      <path d="M4.4 20.3a2.3 2.3 0 014.2 0" {...s} />
      <circle cx="13.5" cy="16.5" r="1.5" {...s} />
      <path d="M11.4 20.3a2.3 2.3 0 014.2 0" {...s} />
      <path d="M18.5 16.5h.01M21 16.5h.01" {...s} />
    </Glyph>
  ),
  // A pad, and the burst it throws over the board.
  'reaction-pads': (
    <Glyph>
      <rect x="4" y="12" width="12" height="8" rx="2" {...s} />
      <path d="M8 16h4" {...s} />
      <path d="M17.5 8.5l3-3M15 6V3M19.5 11.5h3M13.5 8.5l-1.5-1.5" {...s} />
    </Glyph>
  ),
  // Content on the left, still under a mosaic on the right. Two bars for the
  // cover read as a pause button and a left arrow made it a sidebar toggle; a
  // censor mosaic is the one cover idiom nothing else here uses.
  'reveal-zones': (
    <Glyph>
      <rect x="2.5" y="5" width="19" height="14" rx="2" {...s} />
      <path d="M11.5 5v14" {...s} />
      <path d="M5 9.5h4M5 13h3" {...s} />
      <rect x="13.5" y="8" width="3" height="3" rx="0.5" {...s} />
      <rect x="17" y="8" width="3" height="3" rx="0.5" {...s} />
      <rect x="13.5" y="12.5" width="3" height="3" rx="0.5" {...s} />
      <rect x="17" y="12.5" width="3" height="3" rx="0.5" {...s} />
    </Glyph>
  ),
  // A die: the only thing in the set that says "at random" on its own.
  pickers: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="3" {...s} />
      <path d="M8.5 8.5h.01M12 12h.01M15.5 15.5h.01" {...s} />
    </Glyph>
  ),
  // Palette → Tools elements. Concrete objects, so each draws the object — the
  // trap here is the neighbours rather than the subjects: a sheet of prose, a
  // note card and a ticked list are all "a rectangle with lines in it" until the
  // detail that separates them is the loudest thing in the glyph.
  tables: (
    <Glyph>
      <rect x="3" y="4.5" width="18" height="15" rx="2" {...s} />
      <path d="M3 9.5h18M3 14.5h18" {...s} />
      <path d="M9 4.5v15M15 4.5v15" {...s} />
    </Glyph>
  ),
  // A portrait sheet, filled to the edges: the point of a Page is that it holds
  // more prose than a label can.
  pages: (
    <Glyph>
      <rect x="5" y="2.5" width="14" height="19" rx="2" {...s} />
      <path d="M8 7h8M8 10.5h8M8 14h8M8 17.5h5" {...s} />
    </Glyph>
  ),
  // Tilted, because a sticky note on a board never is not.
  'sticky-notes': (
    <Glyph>
      <rect x="4" y="5" width="15" height="15" rx="1.5" transform="rotate(-7 11.5 12.5)" {...s} />
      <path d="M8 10.5h7M8 14h4.5" {...s} />
    </Glyph>
  ),
  'code-blocks': (
    <Glyph>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" {...s} />
      <path d="M9 9.5L6.5 12 9 14.5" {...s} />
      <path d="M15 9.5L17.5 12 15 14.5" {...s} />
      <path d="M12.5 9l-1.5 6" {...s} />
    </Glyph>
  ),
  // Ticked rows, with one still to do — a checklist is only interesting part
  // done.
  checklists: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M6 8.5l1.4 1.4 2.6-2.8" {...s} />
      <path d="M6 14.5l1.4 1.4 2.6-2.8" {...s} />
      <path d="M13 9h5M13 15h5" {...s} />
    </Glyph>
  ),
  // One ring, with the jump going through it. Two rings is the truer picture of
  // the feature (they come in pairs) but neither two-ring version read: joined by
  // a straight line it was the chain that `links` already means, and joined by an
  // arc over the top it was a pair of headphones. An arrow entering a ring is the
  // idiom people know, and the pairing is what the label is for.
  portals: (
    <Glyph>
      <ellipse cx="14" cy="12" rx="5" ry="8.5" {...s} />
      <ellipse cx="14" cy="12" rx="2" ry="4" {...s} />
      <path d="M2 12h7.5" {...s} />
      <path d="M7.5 9.8l2.2 2.2-2.2 2.2" {...s} />
    </Glyph>
  ),
  // Palette → Collaborate elements. Each draws what its own article describes
  // rather than a generic "group activity" mark: five of these are boxes with
  // rows in them, so the distinguishing detail (a gauge, a slot, a clock, a
  // seal, a row of faces) has to carry the meaning.
  'comment-panels': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path
        d="M6 8.5h8a1 1 0 011 1v1.5a1 1 0 01-1 1H8l-2 2v-2a1 1 0 01-1-1V9.5a1 1 0 011-1z"
        {...s}
      />
      <path d="M12 16.5h6" {...s} />
    </Glyph>
  ),
  // Planning poker: a fanned hand with the face card still turned down.
  'estimate-cards': (
    <Glyph>
      <rect x="3.5" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8 12.5)" {...s} />
      <rect x="11" y="5" width="10" height="14" rx="1.5" {...s} />
      <path d="M14.5 9.5a1.5 1.5 0 113 0c0 1.2-1.5 1.3-1.5 2.5" {...s} />
      <path d="M16 15h.01" {...s} />
    </Glyph>
  ),
  // A fist-of-five gauge: the dial and where the room is pointing.
  'temperature-checks': (
    <Glyph>
      <path d="M3.5 17a8.5 8.5 0 1117 0" {...s} />
      <path d="M12 17l4.5-5" {...s} />
      <path d="M12 17h.01M5.5 12.5h.01M8 9h.01M16 9h.01" {...s} />
    </Glyph>
  ),
  // A ballot box: the slot, and a submission going into it unseen.
  'idea-boxes': (
    <Glyph>
      <rect x="3.5" y="10" width="17" height="10.5" rx="2" {...s} />
      <path d="M9 13.5h6" {...s} />
      <rect x="8.5" y="3" width="7" height="5.5" rx="1" {...s} />
      <path d="M12 8.5v1.5" {...s} />
    </Glyph>
  ),
  // The run of a session: its segments, and the time against them.
  agendas: (
    <Glyph>
      <rect x="3" y="4" width="12" height="16" rx="2" {...s} />
      <path d="M6 8h6M6 11.5h6M6 15h3.5" {...s} />
      <circle cx="17.5" cy="16" r="4" {...s} />
      <path d="M17.5 14.2V16l1.3 1" {...s} />
    </Glyph>
  ),
  // A record with the decision ticked beside it. The tick is free-standing: put
  // inside a circle it read as a prohibition sign — the opposite of "decided".
  'decision-records': (
    <Glyph>
      <rect x="3" y="3.5" width="12" height="17" rx="2" {...s} />
      <path d="M6 8h6M6 11.5h6M6 15h3.5" {...s} />
      <path d="M13.5 16.5l2.6 2.6 5-5.6" {...s} />
    </Glyph>
  ),
  // Who was in the room: heads and shoulders against the names. Bare circles
  // beside lines read as a bulleted list, which is not what a roll call is.
  'roll-calls': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <circle cx="7" cy="7.8" r="1.5" {...s} />
      <path d="M4.9 11.6a2.3 2.3 0 014.2 0" {...s} />
      <circle cx="7" cy="14.8" r="1.5" {...s} />
      <path d="M4.9 18.6a2.3 2.3 0 014.2 0" {...s} />
      <path d="M12 9h6M12 16h6" {...s} />
    </Glyph>
  ),
  // Activity Panel category.
  'what-it-is': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M8 9h8M8 13h8M8 17h5" {...s} />
    </Glyph>
  ),
  'how-it-works': (
    <Glyph>
      <circle cx="12" cy="12" r="3" {...s} />
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
        {...s}
      />
    </Glyph>
  ),
  undo: (
    <Glyph>
      <path d="M9 7L4 12l5 5" {...s} />
      <path d="M4 12h11a5 5 0 010 10h-1" {...s} />
    </Glyph>
  ),
  redo: (
    <Glyph>
      <path d="M15 7l5 5-5 5" {...s} />
      <path d="M20 12H9a5 5 0 000 10h1" {...s} />
    </Glyph>
  ),
  'reverting-changes': (
    <Glyph>
      <path d="M3 8a9 9 0 119-2.4L21 8" {...s} />
      <path d="M21 4v4h-4M12 8v4l3 2" {...s} />
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
  // A filled star, because Favourites is the one tile that marks a choice
  // rather than describing a feature.
  favourites: (
    <Glyph>
      <path d="M12 4l2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" {...s} />
    </Glyph>
  ),
  // Two overlapping panels with the back one showing through.
  'panel-opacity': (
    <Glyph>
      <rect x="3" y="3.5" width="12" height="12" rx="2" {...s} />
      <rect x="9" y="8.5" width="12" height="12" rx="2" {...s} />
      <path d="M9 12.5h6M9 15.5h6" {...s} />
    </Glyph>
  ),
  // A plus appearing beside an element, which is the gesture itself.
  'quick-add-on-hover': (
    <Glyph>
      <rect x="3" y="7" width="10" height="10" rx="1.5" {...s} />
      <circle cx="18" cy="6" r="3.5" {...s} />
      <path d="M18 4.5v3M16.5 6h3" {...s} />
    </Glyph>
  ),
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
  // Canvas guides. The four layer entries are deliberately NOT four variations
  // on a stack of sheets: three of them would be indistinguishable at 24px, so
  // each draws the thing its article is about instead — the stack itself, then
  // an eye, a merge, and a reorder.
  'follow-along': (
    <Glyph>
      <path d="M8 4l6.5 15 1.4-6 6-1.6z" {...s} />
      <path d="M4.5 6.5v-2h2M4.5 12.5v-2h2M4.5 18.5v-2h2" {...s} />
    </Glyph>
  ),
  notes: (
    <Glyph>
      <rect x="3" y="4" width="11" height="11" rx="1.5" {...s} />
      <path d="M6 8h5M6 11h3" {...s} />
      <rect x="11" y="12" width="10" height="8" rx="1.5" {...s} />
      <path d="M14 15.5h4M14 18h2.5" {...s} />
    </Glyph>
  ),
  layers: (
    <Glyph>
      <path d="M12 3l8 4.5-8 4.5-8-4.5z" {...s} />
      <path d="M4 12.5l8 4.5 8-4.5" {...s} />
      <path d="M4 17l8 4.5 8-4.5" {...s} />
    </Glyph>
  ),
  'layers-visibility-and-locking': (
    <Glyph>
      <path d="M2.5 11.5S5.5 6 11 6s8.5 5.5 8.5 5.5S16.5 17 11 17s-8.5-5.5-8.5-5.5z" {...s} />
      <circle cx="11" cy="11.5" r="2.5" {...s} />
      <rect x="16" y="16.5" width="6" height="5" rx="1" {...s} />
      <path d="M17.5 16.5v-1.2a1.5 1.5 0 013 0v1.2" {...s} />
    </Glyph>
  ),
  'layers-organising': (
    <Glyph>
      <rect x="4" y="3.5" width="11" height="6" rx="1.5" {...s} />
      <rect x="9" y="14.5" width="11" height="6" rx="1.5" {...s} />
      <path d="M12 10.5v3M10.5 12l1.5 1.5L13.5 12" {...s} />
    </Glyph>
  ),
  'layer-order': (
    <Glyph>
      <rect x="4" y="4" width="12" height="6" rx="1.5" {...s} />
      <rect x="4" y="14" width="12" height="6" rx="1.5" {...s} />
      <path d="M20 8V3.5M18 5.5l2-2 2 2" {...s} />
      <path d="M20 16v4.5M18 18.5l2 2 2-2" {...s} />
    </Glyph>
  ),
  size: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
      <path d="M8 8h5M8 8v5M8 8l5 5" {...s} />
      <path d="M16 16h-5M16 16v-5" {...s} />
    </Glyph>
  ),
  rotation: (
    <Glyph>
      <rect x="6.5" y="9" width="11" height="11" rx="1.5" {...s} />
      <path d="M6 6.5A7 7 0 0119 5" {...s} />
      <path d="M19 1.5V5h-3.5" {...s} />
    </Glyph>
  ),
  animations: (
    <Glyph>
      <rect x="10" y="8" width="10" height="8" rx="1.5" {...s} />
      <path d="M3 9h4M2 12h5M3 15h4" {...s} />
    </Glyph>
  ),
  // The element plus a real drop shadow: a FILLED offset copy behind an
  // outlined one. The only glyph here that fills and fades, because it is the
  // only one whose subject is a fill and a fade — the stroke-only alternatives
  // both landed on another glyph's meaning (two outlined rects read as
  // "duplicate", diagonal hatching read as the motion lines on `animations`).
  shadows: (
    <Glyph>
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        stroke="none"
        opacity="0.3"
      />
      <rect x="4" y="4" width="12" height="12" rx="2" {...s} />
    </Glyph>
  ),
  locking: (
    <Glyph>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" {...s} />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" {...s} />
      <path d="M12 14.5v2.5" {...s} />
    </Glyph>
  ),
  // A magnet, not another set of guide lines: `alignment-guides` in the Palette
  // settings already draws those, and two cards showing the same thing is the
  // problem these glyphs exist to solve.
  snapping: (
    <Glyph>
      <path d="M4.5 4.5v7a7.5 7.5 0 0015 0v-7" {...s} />
      <path d="M10 4.5v7a2 2 0 004 0v-7" {...s} />
      <path d="M4.5 4.5h5.5M14 4.5h5.5" {...s} />
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

/** Top-level feature category → glyph.
 *
 *  The fallback for a landing page with no bespoke icon of its own, and there
 *  are a lot of those: 107 of the 172 cards under the ten feature categories
 *  had no entry in FEATURE_ICONS, so nearly two thirds of the catalogue drew
 *  the SAME sky-blue `the-canvas` frame — and, because featureColours.ts fell
 *  back the same way, in the same grey. A grid where most tiles are identical
 *  stops being a catalogue and becomes decoration: the icon is there to tell
 *  you at a glance whether a card is about the palette or about sharing.
 *
 *  Keyed on the FIRST segment of `categorySlug`, so a nested landing
 *  (`palette/tools/data-elements`) inherits its top-level category's glyph
 *  rather than needing its own. Adding a bespoke entry to FEATURE_ICONS still
 *  wins — this is the floor, not a replacement for drawing the specific thing.
 */
export const FEATURE_CATEGORY_ICONS: Record<string, ReactNode> = {
  // A window with a title bar: the chrome around everything else.
  'user-interface': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M3 9h18M6.5 6.5h.01M9 6.5h.01" {...s} />
    </Glyph>
  ),
  // A frame with shapes drawn inside it.
  canvas: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <rect x="6.5" y="8" width="5" height="4" rx="1" {...s} />
      <circle cx="16" cy="14.5" r="2.5" {...s} />
    </Glyph>
  ),
  // Stacked swatches: the palette is a catalogue you pick from.
  palette: (
    <Glyph>
      <rect x="3.5" y="4" width="8" height="6" rx="1.5" {...s} />
      <rect x="12.5" y="4" width="8" height="6" rx="1.5" {...s} />
      <rect x="3.5" y="14" width="8" height="6" rx="1.5" {...s} />
      <rect x="12.5" y="14" width="8" height="6" rx="1.5" {...s} />
    </Glyph>
  ),
  // Two sheets behind a front one.
  tabs: (
    <Glyph>
      <path d="M3 8h5l1.5-2H14v3" {...s} />
      <rect x="3" y="8" width="18" height="12" rx="2" {...s} />
      <path d="M14 6h4a2 2 0 0 1 2 2" {...s} />
    </Glyph>
  ),
  // A folder tree.
  explorer: (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h4a2 2 0 0 1 2 2v1" {...s} />
      <path d="M3 7v11a2 2 0 0 0 2 2h11" {...s} />
      <path d="M12 20h4M16 12h5M16 16h5" {...s} />
    </Glyph>
  ),
  // Two people.
  collaboration: (
    <Glyph>
      <circle cx="9" cy="8" r="3" {...s} />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" {...s} />
      <path d="M16 6.5a3 3 0 0 1 0 6M17 15.5a5.5 5.5 0 0 1 3.5 4.5" {...s} />
    </Glyph>
  ),
  // A wrench, matching the per-feature `tools` glyph above.
  tools: (
    <Glyph>
      <path
        d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z"
        {...s}
      />
    </Glyph>
  ),
  // A side panel with a magnifier in it.
  'search-panel': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M14 4v16" {...s} />
      <circle cx="8" cy="10.5" r="2.5" {...s} />
      <path d="M9.9 12.4L12 14.5" {...s} />
    </Glyph>
  ),
  // A marquee with a pointer: choosing things is the whole category.
  'selection-modes': (
    <Glyph>
      <path
        d="M4 7V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V7M20 15v3.5a1.5 1.5 0 01-1.5 1.5H16"
        {...s}
      />
      <path d="M4 12v3" {...s} />
      <path d="M9 11l6.5 3-2.7 1 1.6 3-1.6.8-1.6-3-1.9 1.9z" {...s} />
    </Glyph>
  ),
  // A panel with a pulse: what just happened.
  'activity-panel': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" {...s} />
      <path d="M6 13h3l1.5-3 2 6 1.5-3h3" {...s} />
    </Glyph>
  ),
};

/** The glyph for a feature card: the feature's own icon, else its top-level
 *  category's, else the canvas frame. One resolver so the card, the category
 *  index, and the MDX `<Feature>` tile can't disagree about the order. */
export function featureIcon(slug: string, categorySlug?: string): ReactNode {
  return (
    FEATURE_ICONS[slug] ??
    FEATURE_CATEGORY_ICONS[topCategorySlug(categorySlug ?? '')] ??
    FEATURE_ICONS['the-canvas']
  );
}
