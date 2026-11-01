import {
  lucideAppWindow,
  lucideClock,
  lucideFilePlus,
  lucideFolder,
  lucidePanelLeft,
  lucidePanelsTopLeft,
  lucideSearch,
  lucideSquareKanban,
  lucideTimer,
  lucideUsers,
  lucideVote,
} from '@liveworkspace/icons/lucide';
import { Prims, Glyph as UiGlyph } from '@liveplanner/ui';
import type { ReactNode } from 'react';

/** Feature slug → icon (full <svg>). Used by the home grid, the features
 *  index, and the MDX <Feature> cards. Outline glyphs at w-6 h-6,
 *  `currentColor` so the call site sets the hue (see featureColours.ts).
 *  Add an entry here when adding a feature landing page. Missing slugs fall
 *  back to their category's glyph, then to FEATURE_FALLBACK_ICON. */
export function Glyph({ children }: { children: ReactNode }) {
  return (
    <UiGlyph size={24} units={24} className="h-6 w-6">
      {children}
    </UiGlyph>
  );
}

export const FEATURE_ICONS: Record<string, ReactNode> = {
  'planning-basics': (
    <Glyph>
      <Prims prims={lucideSquareKanban} />
    </Glyph>
  ),
  // User Interface.
  'panel-layout': (
    <Glyph>
      <Prims prims={lucidePanelLeft} />
    </Glyph>
  ),
  'zoom-controls': (
    <Glyph>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
    </Glyph>
  ),
  'tab-bar': (
    <Glyph>
      <path d="M3 8a2 2 0 012-2h4l1.5 2H21v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </Glyph>
  ),
  'quick-controls': (
    <Glyph>
      <circle cx="6" cy="18" r="3" />
      <path d="M14 14l7-7M14 7h7v7" />
    </Glyph>
  ),
  tools: (
    <Glyph>
      <path d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z" />
    </Glyph>
  ),
  themes: (
    <Glyph>
      <path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 13 16 13h2a3 3 0 003-3c0-4-4.5-7-9-7z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9.5" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  items: (
    <Glyph>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
      <path d="M7 6v12" />
      <path d="M10 10h6M10 14h4" />
    </Glyph>
  ),
  // A board header over three columns of differing heights: a board with its widgets.
  boards: (
    <Glyph>
      <rect x="2.5" y="3" width="19" height="18" rx="1.5" />
      <path d="M2.5 7.5h19" />
      <path d="M5 4.9h4" />
      <rect x="4.5" y="10" width="4" height="8.5" rx="0.6" />
      <rect x="10" y="10" width="4" height="5.5" rx="0.6" />
      <rect x="15.5" y="10" width="4" height="7" rx="0.6" />
    </Glyph>
  ),
  // A card opened up: its title, a description line and a checklist tick.
  cards: (
    <Glyph>
      <rect x="3.5" y="3" width="17" height="18" rx="1.5" />
      <path d="M7 7h10M7 10.5h7" />
      <path d="M7 15l1.5 1.5L11 14M13.5 15.5h3.5" />
    </Glyph>
  ),
  // Two cards, one behind the other, each with its type stripe: kinds of card.
  'card-types': (
    <Glyph>
      <path d="M7 5.5V4.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 21 4.5v9a1.5 1.5 0 0 1-1.5 1.5H18" />
      <rect x="3" y="8" width="15" height="12" rx="1.5" />
      <path d="M6 8v12M9 12h6M9 15.5h4" />
    </Glyph>
  ),
  // Three cards in a column, the top two ticked and ringed: several cards picked at once.
  'select-cards': (
    <Glyph>
      <rect x="3" y="3" width="18" height="5" rx="1.2" strokeWidth="2.2" />
      <rect x="3" y="10" width="18" height="5" rx="1.2" strokeWidth="2.2" />
      <rect x="3" y="17" width="18" height="4.5" rx="1.2" />
      <path d="M6 5.6l1.2 1.1 2-2.2M6 12.6l1.2 1.1 2-2.2M12 5.5h6M12 12.5h6M7 19.25h11" />
    </Glyph>
  ),
  // A card with a clock turning back over its corner: the card's own history.
  'card-activity': (
    <Glyph>
      <path d="M11 20H4.5A1.5 1.5 0 013 18.5v-14A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V8" />
      <path d="M6 7h6M6 10.5h3.5" />
      <path d="M12.2 13.2a5 5 0 11.6 5.3" />
      <path d="M11.8 10.8v2.6h2.6" />
      <path d="M17 13.4v2.6l1.6 1" />
    </Glyph>
  ),
  // A pen over a squiggle with a dashed spotlight ring round it: a guided look at Draw.
  'plan-tour': (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M8.8 4v16M15.2 4v16" />
      <rect x="10.4" y="8" width="3.2" height="4" rx="0.6" />
      <rect x="9" y="6.5" width="6" height="7" rx="1.5" strokeDasharray="1.6 1.4" />
      <path d="M4.5 16h2.5M17 16h2.5" />
    </Glyph>
  ),
  // A clipboard holding two ticked lines: a form filled in.
  forms: (
    <Glyph>
      <rect x="4.5" y="4" width="15" height="17.5" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M7.5 10.5l1.2 1.2 2.3-2.4M13 10.5h4M7.5 16l1.2 1.2 2.3-2.4M13 16h4" />
    </Glyph>
  ),
  // A page of rows and slots, a wide one over two, the first holding a small ring: a dashboard.
  dashboards: (
    <Glyph>
      <rect x="2.5" y="3.5" width="19" height="7" rx="1.5" />
      <rect x="2.5" y="12.5" width="9" height="8" rx="1.5" />
      <rect x="12.5" y="12.5" width="9" height="8" rx="1.5" />
      <circle cx="7" cy="16.5" r="2" />
      <path d="M15 18.5v-2M17 18.5v-4M19 18.5v-3M5.5 7h7" />
    </Glyph>
  ),
  // A grid with a header row and one highlighted cell: a spreadsheet tab.
  sheets: (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <path d="M2.5 8.5h19M2.5 13h19M2.5 16.5h19M8 4v16M14.5 4v16" />
      <rect x="8.6" y="13.6" width="5.3" height="2.3" rx="0.4" />
    </Glyph>
  ),
  // The function sign over a pair of brackets: what a formula calls.
  'sheet-functions': (
    <Glyph>
      <path d="M11 4.5c-1.6 0-2.4 1-2.7 2.6L6.6 19.5" />
      <path d="M5.5 10h5.5" />
      <path d="M15 9.5c-1.2 1.2-1.8 2.6-1.8 4.5s.6 3.3 1.8 4.5M19 9.5c1.2 1.2 1.8 2.6 1.8 4.5s-.6 3.3-1.8 4.5" />
    </Glyph>
  ),
  // A window onto a small diagram: another tab shown live inside it.
  'using-tabs': (
    <Glyph>
      <Prims prims={lucidePanelsTopLeft} />
    </Glyph>
  ),
  comments: (
    <Glyph>
      <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
    </Glyph>
  ),
  'live-presence': (
    <Glyph>
      <path d="M4 5l7 14 2.2-5.8L19 11 4 5z" />
      <circle cx="18" cy="6" r="2.5" />
    </Glyph>
  ),
  'explorer-page': (
    <Glyph>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </Glyph>
  ),
  'explorer-panel': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Glyph>
  ),
  teams: (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  sharing: (
    <Glyph>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </Glyph>
  ),
  'zen-mode': (
    <Glyph>
      <path d="M3 12h4l2 5 4-12 2 7h6" />
    </Glyph>
  ),
  timer: (
    <Glyph>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.5l2.5 1.5" />
      <path d="M10 3h4M12 3v3" />
      <path d="M18.5 6.5l1.5-1.5" />
    </Glyph>
  ),
  // Dots landing ON something — the sub-article `casting-dots` draws the dots
  // themselves, so the parent draws what they are spent on.
  voting: (
    <Glyph>
      <rect x="3" y="14" width="18" height="6.5" rx="1.5" />
      <circle cx="7.5" cy="8" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="8" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5.5" r="2" />
    </Glyph>
  ),
  // An envelope with the invitee on it, which is how a role reaches someone.
  'roles-and-invites': (
    <Glyph>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 7l9.5 6 9.5-6" />
      <circle cx="12" cy="15" r="1.6" />
      <path d="M9.6 18.8a2.6 2.6 0 014.8 0" />
    </Glyph>
  ),
  // A folder handed outward: the team library is a folder every member can reach.
  // `search-teams` is a folder with people INSIDE it, which is a different claim.
  'team-shared-projects': (
    <Glyph>
      <path d="M2.5 8A1.5 1.5 0 014 6.5h4L9.5 8.5h5A1.5 1.5 0 0116 10v7.5A1.5 1.5 0 0114.5 19H4A1.5 1.5 0 012.5 17.5z" />
      <path d="M17.5 8.5H22" />
      <path d="M19.5 6l2.5 2.5-2.5 2.5" />
    </Glyph>
  ),
  // Work on an element, with a name against it.
  'share-passwords': (
    <Glyph>
      <rect x="2.5" y="8" width="19" height="8" rx="2.5" />
      <circle cx="7.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M19 12h.01" />
      <path d="M12 5.5V4a2.5 2.5 0 015 0v1.5" />
    </Glyph>
  ),
  // A row of tabs where only the middle one is solid: the one tab a link opens.
  'one-tab': (
    <Glyph>
      <Prims prims={lucidePanelsTopLeft} />
    </Glyph>
  ),
  // A chain whose far ring is a clock: the link, and the deadline on it.
  'share-link-expiry': (
    <Glyph>
      <path d="M8.5 12H4.5a3 3 0 010-6h5" />
      <path d="M6 9h6" />
      <circle cx="15.5" cy="14.5" r="6" />
      <path d="M15.5 11.5v3l2.2 1.4" />
    </Glyph>
  ),
  // A project inside somebody else's page — the outer frame is the point.
  embeds: (
    <Glyph>
      <rect x="2" y="3.5" width="20" height="17" rx="2" />
      <path d="M2 7.5h20" />
      <rect x="5.5" y="10.5" width="6" height="4" rx="1" />
      <circle cx="17" cy="15.5" r="2.2" />
      <path d="M11.5 12.5h3.5" />
    </Glyph>
  ),
  // A picture that keeps refreshing itself.
  'live-image': (
    <Glyph>
      <path d="M20.5 11V6a2 2 0 00-2-2H5.5a2 2 0 00-2 2v12a2 2 0 002 2h6" />
      <path d="M3.5 16l4-4 3 2.5" />
      <circle cx="15" cy="8.5" r="1.5" />
      <path d="M15 15.5a4 4 0 016.5-1.5" />
      <path d="M21.5 11.5V14h-2.5" />
    </Glyph>
  ),
  // Collaboration → Voting. Five articles about one feature, so the collisions
  // here are internal: every one of them could have been "some dots". Each draws
  // its own subject instead — spending a dot, restricting to a layer, hiding the
  // count, tracking the room, and what won.
  //
  // `casting-dots` deliberately has no enclosing square: dots inside a box is the
  // die that `pickers` already draws.
  'casting-dots': (
    <Glyph>
      <Prims prims={lucideVote} />
    </Glyph>
  ),
  // A struck-through eye: the counts and the cursors are what stay hidden. The
  // open eye belongs to layer visibility, which is a different question.
  'vote-privacy': (
    <Glyph>
      <path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 20L20 4" />
    </Glyph>
  ),
  // A panel tracking the room: who has voted, and how far along it is.
  'vote-panel': (
    <Glyph>
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <path d="M3 8h18" />
      <path d="M6 11.5h7M6 15h5" />
      <rect x="6" y="17.5" width="12" height="1.5" rx="0.75" />
      <path d="M6 18.25h5" />
    </Glyph>
  ),
  // A podium: the tallest in the middle, which is what a ranked result looks
  // like. No axes, so it cannot be read as the bar chart.
  'vote-results': (
    <Glyph>
      <rect x="9" y="5.5" width="6" height="15" rx="1" />
      <rect x="2.5" y="11" width="6" height="9.5" rx="1" />
      <rect x="15.5" y="14" width="6" height="6.5" rx="1" />
      <path d="M11.5 9h1v4" />
    </Glyph>
  ),
  // Palette → Data elements. Charts are the easiest subjects in the whole set —
  // each has one unmistakable idiom — with one exception: Rating is stars, and a
  // star reads as a favourite. So Rating draws the SCALE (a row, part filled)
  // rather than the symbol.
  // Just the bar, filled part-way. Drawing the ring above the bar — to cover both
  // halves of "Bars and Rings" — made a circle sitting on a stem, which reads as
  // a lightbulb and nothing else. One honest half beats two unreadable ones.
  'side-by-side': (
    <Glyph>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="M12 4.5v15" />
      <path d="M5 7.5h4M15 7.5h4" />
      <path d="M10.5 12l1.5-1.5 1.5 1.5" />
    </Glyph>
  ),
  // A tab with the padlock on it. `locking` is the bare padlock, for an element.
  'locking-tabs': (
    <Glyph>
      <path d="M3 8h5l1.5-2H14v2" />
      <path d="M3 8v10a2 2 0 002 2h5" />
      <path d="M14 6h4a2 2 0 012 2v2" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
      <path d="M15 14v-1.5a2 2 0 014 0V14" />
    </Glyph>
  ),
  // Two helpers, not one: a question asked, and a sweep that tidies.
  about: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </Glyph>
  ),
  // The canvas, with its small map and the viewport box inside it.
  settings: (
    <Glyph>
      <rect x="3" y="5" width="18" height="6" rx="3" />
      <circle cx="7.5" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <rect x="3" y="14" width="18" height="6" rx="3" />
      <circle cx="16.5" cy="17" r="1.6" fill="currentColor" stroke="none" />
    </Glyph>
  ),
  // A lightning bolt over a bare bar: faster defaults, fewer words.
  'power-user-mode': (
    <Glyph>
      <path d="M13 2.5 6.5 12h5l-1 7.5L17 10h-5z" />
      <path d="M3 21.5h18" />
    </Glyph>
  ),
  // Canvas sub-article guides — the ten that finish the Canvas category. Once a
  // category is fully drawn its fallback glyph never renders inside it, which is
  // the point of working category by category.
  'changing-theme': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="7.5" cy="8.5" r="1.5" />
      <path d="M11 8.5h6.5" />
      <circle cx="7.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M11 12h6.5" />
      <circle cx="7.5" cy="15.5" r="1.5" />
      <path d="M11 15.5h4.5" />
    </Glyph>
  ),
  // Two elements, both with handles on them: many things selected at once.
  undo: (
    <Glyph>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h11a5 5 0 010 10h-1" />
    </Glyph>
  ),
  redo: (
    <Glyph>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 000 10h1" />
    </Glyph>
  ),
  'session-tools': (
    <Glyph>
      <Prims prims={lucideTimer} />
    </Glyph>
  ),
  'list-and-card-views': (
    <Glyph>
      <path d="M3 7h6M3 12h6M3 17h6" />
      <rect x="12.5" y="5" width="8.5" height="6" rx="1.5" />
      <rect x="12.5" y="13" width="8.5" height="6" rx="1.5" />
    </Glyph>
  ),
  // Home, the Explorer's landing page: a house.
  home: (
    <Glyph>
      <path d="M4 11.5 12 4.5l8 7" />
      <path d="M6 10v9.5h4.5v-5h3v5H18V10" />
    </Glyph>
  ),
  // An inbox tray with a tick above it: what is waiting on you, as opposed
  // to the Timeline's spine of what happened.
  activity: (
    <Glyph>
      <path d="M3 13.5V18a2 2 0 002 2h14a2 2 0 002-2v-4.5" />
      <path d="M3 13.5h4.5l1.5 2.5h6l1.5-2.5H21" />
      <path d="M8.5 7.5 11 10l4.5-5" />
    </Glyph>
  ),
  // A spine with two events on it and their lines of text: what happened, in order (the Explorer sidebar's mark).
  // A funnel: a list, narrowed.
  filters: (
    <Glyph>
      <path d="M3 4.5h18l-7 8v6l-4 2v-8z" />
    </Glyph>
  ),
  timeline: (
    <Glyph>
      <path d="M6 3.5v17" />
      <circle cx="6" cy="7.5" r="1.6" />
      <circle cx="6" cy="16.5" r="1.6" />
      <path d="M10 7.5h9M10 16.5h6M10 12h4.2" />
    </Glyph>
  ),
  // One folder inside another, which is the whole point of a nestable tree.
  folders: (
    <Glyph>
      <path d="M2.5 6.5A1.5 1.5 0 014 5h3.5L9 6.5h4A1.5 1.5 0 0114.5 8v2" />
      <path d="M2.5 6.5v10A1.5 1.5 0 004 18h4" />
      <path d="M9 12.5A1.5 1.5 0 0110.5 11h2l1.5 1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 019 19z" />
    </Glyph>
  ),
  // An account, not a person in a list: the head sits in its avatar ring.
  profile: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="2.8" />
      <path d="M6.5 19a6 6 0 0111 0" />
    </Glyph>
  ),
  // Explorer section guides.
  recent: (
    <Glyph>
      <Prims prims={lucideClock} />
    </Glyph>
  ),
  'shared-with-you': (
    <Glyph>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="17" cy="6.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="M8.2 10.8l6.6-3.4M8.2 13.2l6.6 3.4" />
    </Glyph>
  ),
  'personal-space': (
    <Glyph>
      <Prims prims={lucideFolder} />
    </Glyph>
  ),
  'team-spaces': (
    <Glyph>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 6.5a3 3 0 0 1 0 5.8M17 19a5.5 5.5 0 0 0-3-4.9" />
    </Glyph>
  ),
  // Tabs guides.
  'tab-folders': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </Glyph>
  ),
  'add-to-project': (
    <Glyph>
      <rect x="3" y="3" width="12" height="12" rx="2" />
      <path d="M9 21h10a2 2 0 0 0 2-2V9" />
      <path d="M17 13v4M15 15h4" />
    </Glyph>
  ),
  'import-tabs': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 3v9M9 9l3 3 3-3" />
    </Glyph>
  ),
  // A luggage tag with its eyelet: a label you put on a project.
  tags: (
    <Glyph>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7a1 1 0 0 1 .7.3l7.6 7.6a1 1 0 0 1 0 1.4l-7.7 7.7a1 1 0 0 1-1.4 0l-7.6-7.6a1 1 0 0 1-.3-.7z" />
      <circle cx="8" cy="8" r="1.5" />
    </Glyph>
  ),
  'export-tabs': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 14V4M9 7l3-3 3 3" />
    </Glyph>
  ),
  'command-palette': (
    <Glyph>
      <rect x="2.5" y="7" width="19" height="10" rx="2.5" />
      <path d="M6 10.5l2 1.5-2 1.5" />
      <path d="M11 13.5h7" />
    </Glyph>
  ),
  'search-projects': (
    <Glyph>
      <path d="M3 7a1.5 1.5 0 011.5-1.5h4L10 7.5h8A1.5 1.5 0 0119.5 9v8.5A1.5 1.5 0 0118 19H4.5A1.5 1.5 0 013 17.5z" />
      <rect x="5.5" y="11" width="4.5" height="3.5" rx="0.5" />
      <circle cx="15.5" cy="12.75" r="2" />
      <path d="M10 12.75h3.5" />
    </Glyph>
  ),
  'search-teams': (
    <Glyph>
      <path d="M3 7a1.5 1.5 0 011.5-1.5h4L10 7.5h8A1.5 1.5 0 0119.5 9v8.5A1.5 1.5 0 0118 19H4.5A1.5 1.5 0 013 17.5z" />
      <circle cx="9.5" cy="12" r="1.5" />
      <path d="M7.2 16.2a2.5 2.5 0 014.6 0" />
      <circle cx="14.5" cy="12" r="1.5" />
      <path d="M12.2 16.2a2.5 2.5 0 014.6 0" />
    </Glyph>
  ),
  // A tab above, and the element inside it that the search jumped to.
  'search-tabs-and-elements': (
    <Glyph>
      <Prims prims={lucideSearch} />
    </Glyph>
  ),
  // A shape arriving on the canvas from above.
  'search-create-tab': (
    <Glyph>
      <Prims prims={lucideFilePlus} />
    </Glyph>
  ),
  // Search Panel guide.
  'the-search-panel': (
    <Glyph>
      <circle cx="11" cy="11" r="7" />
      <path d="M16 16l5 5" />
    </Glyph>
  ),
  // Light/dark mode guide.
  'dark-mode': (
    <Glyph>
      <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" />
    </Glyph>
  ),
  'title-bar': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M6 6.5h5" />
      <rect x="13" y="5.5" width="5" height="2" rx="1" />
    </Glyph>
  ),
  visualisations: (
    <Glyph>
      <rect x="2.5" y="3.5" width="19" height="17" rx="1.5" />
      <path d="M5 8h7M8 12h8M6.5 16h6" />
      <path d="M14.5 5.5v13" strokeDasharray="1.5 1.5" />
    </Glyph>
  ),
};

/** The glyph for a card with neither a bespoke icon nor a category one: a plain rounded square. */
export const FEATURE_FALLBACK_ICON: ReactNode = (
  <Glyph>
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </Glyph>
);

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
  // A kanban board: Plan's boards, sheets, forms and dashboards.
  plan: (
    <Glyph>
      <Prims prims={lucideSquareKanban} />
    </Glyph>
  ),
  // A window with a title bar: the chrome around everything else.
  'user-interface': (
    <Glyph>
      <Prims prims={lucideAppWindow} />
    </Glyph>
  ),
  // A frame of panels: a project's tabs.
  tabs: (
    <Glyph>
      <Prims prims={lucidePanelsTopLeft} />
    </Glyph>
  ),
  // A folder tree.
  explorer: (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h4a2 2 0 0 1 2 2v1" />
      <path d="M3 7v11a2 2 0 0 0 2 2h11" />
      <path d="M12 20h4M16 12h5M16 16h5" />
    </Glyph>
  ),
  // Two people.
  collaboration: (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  // A wrench, matching the per-feature `tools` glyph above.
  tools: (
    <Glyph>
      <path d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z" />
    </Glyph>
  ),
  // A side panel with a magnifier in it.
  'search-panel': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M14 4v16" />
      <circle cx="8" cy="10.5" r="2.5" />
      <path d="M9.9 12.4L12 14.5" />
    </Glyph>
  ),
  // A marquee with a pointer: choosing things is the whole category.
};
