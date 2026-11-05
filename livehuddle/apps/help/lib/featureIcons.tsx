import {
  lucideAppWindow,
  lucideBrushCleaning,
  lucideClock,
  lucideFilePlus,
  lucideFolder,
  lucideFootprints,
  lucideHeadphones,
  lucideLayoutGrid,
  lucideLink,
  lucideLocateFixed,
  lucideMagnet,
  lucidePanelLeft,
  lucidePanelsTopLeft,
  lucideSearch,
  lucideSquarePlus,
  lucideTimer,
  lucideToggleRight,
  lucideUsers,
  lucideVideo,
  lucideVote,
} from '@liveworkspace/icons/lucide';
import { Prims, Glyph as UiGlyph } from '@livehuddle/ui';
import type { ReactNode } from 'react';

/** Feature slug → icon (full <svg>). Used by the home grid, the features
 *  index, and the MDX <Feature> cards. Outline glyphs at w-6 h-6,
 *  `currentColor` so the call site sets the hue (see featureColours.ts).
 *  Add an entry here when adding a feature landing page. Missing slugs fall
 *  back to the `the-canvas` icon at the call site. */
export function Glyph({ children }: { children: ReactNode }) {
  return (
    <UiGlyph size={24} units={24} className="h-6 w-6">
      {children}
    </UiGlyph>
  );
}

export const FEATURE_ICONS: Record<string, ReactNode> = {
  // User Interface.
  'panel-layout': (
    <Glyph>
      <Prims prims={lucidePanelLeft} />
    </Glyph>
  ),
  toolbar: (
    <Glyph>
      <rect x="3" y="8" width="18" height="6" rx="2" />
      <path d="M7 11h.01M11 11h.01M15 11h.01" />
    </Glyph>
  ),
  'context-menus': (
    <Glyph>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
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
  'the-canvas': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v5" />
    </Glyph>
  ),
  // Palette → Selection Modes.
  // Selection-mode guides. Two of these are people, and the set already has five
  // person glyphs (`chairs`, `roll-calls`, `search-teams`, `profile`,
  // `done-checks`) — every one of them a head-and-shoulders bust. So these two are
  // whole figures mid-stride, which is also what the feature is: walking.
  'avatar-mode': (
    <Glyph>
      <Prims prims={lucideFootprints} />
    </Glyph>
  ),
  // Two figures, same construction as one. A trail between them read as stray
  // debris under their feet at this size, so the pairing is left to the label.
  'walking-together': (
    <Glyph>
      <Prims prims={lucideUsers} />
    </Glyph>
  ),
  select: (
    <Glyph>
      <path d="M5 3l6 16 2.5-6.5L20 10 5 3z" />
    </Glyph>
  ),
  hand: (
    <Glyph>
      <path d="M8 11V5.5a1.5 1.5 0 013 0V10m0-.5V4.5a1.5 1.5 0 013 0V10m0-.5V6a1.5 1.5 0 013 0v6a7 7 0 01-7 7h-1a6 6 0 01-5-3l-2.5-4a1.6 1.6 0 012.7-1.7L8 13" />
    </Glyph>
  ),
  eraser: (
    <Glyph>
      <path d="M4 14l6-6 7 7-4 4H8l-4-4a1 1 0 010-1.4z" />
      <path d="M10 8l6 6M9 19h11" />
    </Glyph>
  ),
  'format-painter': (
    <Glyph>
      <path d="M4 5a1 1 0 011-1h11a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
      <path d="M17 6h2a1 1 0 011 1v3a1 1 0 01-1 1h-6a1 1 0 00-1 1v2M11 15h2v6h-2z" />
    </Glyph>
  ),
  laser: (
    <Glyph>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Glyph>
  ),
  spotlight: (
    <Glyph>
      <Prims prims={lucideLocateFixed} />
    </Glyph>
  ),
  'isometric-mode': (
    <Glyph>
      <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" />
      <path d="M12 12l9-4M12 12v9M12 12L3 8" />
    </Glyph>
  ),
  // Palette → Elements.
  // The element families the Build / Write / Collaborate / Behaviour tabs
  // hold. Each one draws the thing it makes, so the tab reads before the label
  // does — the whole reason these tiles exist.
  write: (
    <Glyph>
      <path d="M4 20l1-4 9.5-9.5a2 2 0 012.8 2.8L8 18.8z" />
      <path d="M13 7.5l3.5 3.5" />
    </Glyph>
  ),
  build: (
    <Glyph>
      <rect x="3" y="13" width="8" height="7" rx="1" />
      <rect x="13" y="13" width="8" height="7" rx="1" />
      <rect x="8" y="4" width="8" height="7" rx="1" />
    </Glyph>
  ),
  // A chair in profile: back, seat, two legs. Drawn side-on because a front-on
  // chair is a rectangle on sticks, which reads as a table.
  chairs: (
    <Glyph>
      <rect x="7" y="3.5" width="10" height="9" rx="2" />
      <path d="M5 15h14" />
      <path d="M8 15v5.5M16 15v5.5" />
    </Glyph>
  ),
  // Three pointed pickets on two rails: a fence, not a grid.
  fences: (
    <Glyph>
      <path d="M5 20V7l1.5-2.5L8 7v13M11 20V7l1.5-2.5L14 7v13M17 20V7l1.5-2.5L20 7v13" />
      <path d="M3 10.5h18M3 15.5h18" />
    </Glyph>
  ),
  // A round platform with a beam rising out of it: where a character arrives.
  'avatar-pads': (
    <Glyph>
      <ellipse cx="12" cy="17" rx="8.5" ry="3" />
      <path d="M3.5 17v1.5c0 1.7 3.8 3 8.5 3s8.5-1.3 8.5-3V17" />
      <path d="M8.5 14V6.5M15.5 14V6.5" opacity="0.55" />
      <path d="M12 14.5V3" />
    </Glyph>
  ),
  // A room's walls with a doorway, a little table and a plant: an office floor plan.
  'virtual-office': (
    <Glyph>
      <path d="M10 21H3V3h18v18h-7" />
      <rect x="7" y="8" width="7" height="4" rx="1" />
      <path d="M17.5 13v-3M16 10h3" />
    </Glyph>
  ),
  // The Stage: a platform's top and the front face you see, with a microphone on a stand, as its palette tile.
  stage: (
    <Glyph>
      <path d="M4.5 13.5h15L22 17H2z" />
      <path d="M2 17v3.5h20V17" />
      <rect x="10.25" y="2.5" width="3.5" height="5.5" rx="1.75" />
      <path d="M12 8v5.5" />
    </Glyph>
  ),
  // A pressable pill with the pointer arriving from outside it: every Behaviour
  // element is something a participant activates rather than reads. The pointer
  // sits clear of the pill — overlapping the two made one shape nobody could
  // read as either.
  behaviour: (
    <Glyph>
      <rect x="3" y="5" width="14" height="7" rx="3.5" />
      <path d="M6.5 8.5h7" />
      <path d="M13 15l6.5 2.5-2.8.9-.9 2.8z" />
    </Glyph>
  ),
  // A die-cut plate: the outer cut line, the white margin inside it, and a motif
  // on the plate. Deliberately NOT a folded corner — that idiom already means a
  // document here (`document`, `page`), and a sticker is the opposite of a page.
  stickers: (
    <Glyph>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="3.5" />
      <path d="M12 9l1.3 2.7 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
    </Glyph>
  ),
  tools: (
    <Glyph>
      <path d="M14.5 5.5a3.5 3.5 0 00-4.8 4.6l-6 6a1.5 1.5 0 002.1 2.1l6-6a3.5 3.5 0 004.6-4.8l-2.3 2.3-2-2 2.4-2.2z" />
    </Glyph>
  ),
  icons: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 10a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
    </Glyph>
  ),
  'selecting-and-grouping': (
    <Glyph>
      <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </Glyph>
  ),
  'text-and-fonts': (
    <Glyph>
      <path d="M5 6V5h14v1M12 5v14M9 19h6" />
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
  templates: (
    <Glyph>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </Glyph>
  ),
  // A speech bubble over a little figure, under a dashed spotlight ring: a guided look at Avatar mode.
  'avatar-tour': (
    <Glyph>
      <path d="M8 6h8a2 2 0 012 2v2a2 2 0 01-2 2h-3l-1 2-1-2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
      <circle cx="12" cy="16" r="1.4" />
      <path d="M10 20c0-1.2.9-2 2-2s2 .8 2 2" />
      <circle cx="12" cy="12" r="10" strokeDasharray="1.6 1.4" />
    </Glyph>
  ),
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
  // A baton being passed: one hand open, the bar crossing to it. Not a person
  // (live-presence has the pointer-and-dot) and not a clock (the timer's).
  facilitator: (
    <Glyph>
      <path d="M5 15.5l7-7" />
      <circle cx="4.2" cy="16.3" r="1.9" />
      <path d="M14.5 5.5l4 4" />
      <path d="M19.5 14.5v3.2a1.8 1.8 0 01-1.8 1.8h-3.4" />
    </Glyph>
  ),
  'live-presence': (
    <Glyph>
      <path d="M4 5l7 14 2.2-5.8L19 11 4 5z" />
      <circle cx="18" cy="6" r="2.5" />
    </Glyph>
  ),
  // Calls: the headphones the call strip shows a listener, and the camera its Camera button shows.
  'proximity-audio': (
    <Glyph>
      <Prims prims={lucideHeadphones} />
    </Glyph>
  ),
  'cameras-and-screen-sharing': (
    <Glyph>
      <Prims prims={lucideVideo} />
    </Glyph>
  ),
  links: (
    <Glyph>
      <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7L12 19" />
    </Glyph>
  ),
  images: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5L5 20" />
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
  history: (
    <Glyph>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
      <path d="M3 4v4h4M12 8v4l3 2" />
    </Glyph>
  ),
  // Collaboration guides — the six that finish the Collaboration category. Every
  // one of them had an obvious drawing already spoken for: a clock is on `agendas`
  // and `share-link-expiry`, dots are `casting-dots`, people-in-a-folder is
  // `search-teams`, a tick with people is `done-checks`. So each takes the next
  // detail down.
  //
  // A stopwatch, not a clock: the crown and lugs are what separate it from the
  // two clock badges already in the set.
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
  'team-shared-documents': (
    <Glyph>
      <path d="M2.5 8A1.5 1.5 0 014 6.5h4L9.5 8.5h5A1.5 1.5 0 0116 10v7.5A1.5 1.5 0 0114.5 19H4A1.5 1.5 0 012.5 17.5z" />
      <path d="M17.5 8.5H22" />
      <path d="M19.5 6l2.5 2.5-2.5 2.5" />
    </Glyph>
  ),
  // Work on an element, with a name against it.
  'assigned-actions': (
    <Glyph>
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="M6 10l1.6 1.6 3.4-3.6" />
      <path d="M6 15h6" />
      <circle cx="18.5" cy="15.5" r="2" />
      <path d="M15.7 20a3 3 0 015.6 0" />
    </Glyph>
  ),
  // Collaboration → Sharing guides. Most of the obvious drawings were already
  // taken: a padlock is `locking`, a chain is `links`, a picture is `images`. So
  // each of these draws the thing that makes it a SHARING article — the password
  // field, the deadline, the page it sits inside, the refresh.
  //
  // The obscured field, not a padlock: `locking` owns the padlock, and what this
  // article is actually about is the password you set.
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
  // A gallery wall: three framed boards, one with a heart on it.
  community: (
    <Glyph>
      <rect x="2.5" y="4" width="8" height="7" rx="1.5" />
      <rect x="13.5" y="4" width="8" height="7" rx="1.5" />
      <rect x="2.5" y="14" width="8" height="6" rx="1.5" />
      <path d="M17.5 20.5l-2.6-2.5a1.6 1.6 0 012.6-1.9 1.6 1.6 0 012.6 1.9z" />
    </Glyph>
  ),
  // A search glass over a hashtag: finding boards by their tags.
  'finding-community-documents': (
    <Glyph>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M9 7.5 8 13.5M12.5 7.5l-1 6M7 9.5h6M6.5 11.5h6" />
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
  // A document inside somebody else's page — the outer frame is the point.
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
  // The stack, with the dots landing on one sheet of it.
  'vote-layers': (
    <Glyph>
      <path d="M12 3l7.5 4.2-7.5 4.2-7.5-4.2z" />
      <path d="M4.5 12l7.5 4.2 7.5-4.2" />
      <path d="M4.5 16.5L12 20.7l7.5-4.2" />
      <circle cx="9.5" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
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
  // Palette → Behaviour elements. Every one of these is, physically, a button
  // someone presses, and the `behaviour` family glyph above already draws that.
  // So none of them draws a button being pressed: each draws what pressing it
  // DOES, which is the only thing that tells them apart.
  // A reticle: the mark you put over the thing you want looked at. Distinct
  // from the reveal's eye (about seeing) and the portal's arrow (about going).
  'bring-focus': (
    <Glyph>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </Glyph>
  ),
  'mode-buttons': (
    <Glyph>
      <Prims prims={lucideToggleRight} />
    </Glyph>
  ),
  // A pad, and the burst it throws over the canvas.
  'reaction-pads': (
    <Glyph>
      <rect x="4" y="12" width="12" height="8" rx="2" />
      <path d="M8 16h4" />
      <path d="M17.5 8.5l3-3M15 6V3M19.5 11.5h3M13.5 8.5l-1.5-1.5" />
    </Glyph>
  ),
  // Tilted, because a sticky note on a board never is not.
  'sticky-notes': (
    <Glyph>
      <rect x="4" y="5" width="15" height="15" rx="1.5" transform="rotate(-7 11.5 12.5)" />
      <path d="M8 10.5h7M8 14h4.5" />
    </Glyph>
  ),
  // One ring, with the jump going through it. Two rings is the truer picture of
  // the feature (they come in pairs) but neither two-ring version read: joined by
  // a straight line it was the chain that `links` already means, and joined by an
  // arc over the top it was a pair of headphones. An arrow entering a ring is the
  // idiom people know, and the pairing is what the label is for.
  portals: (
    <Glyph>
      <ellipse cx="14" cy="12" rx="5" ry="8.5" />
      <ellipse cx="14" cy="12" rx="2" ry="4" />
      <path d="M2 12h7.5" />
      <path d="M7.5 9.8l2.2 2.2-2.2 2.2" />
    </Glyph>
  ),
  frames: (
    <Glyph>
      <path d="M3.5 7.5V6a1.5 1.5 0 011.5-1.5h4.5V7.5" />
      <rect x="3.5" y="7.5" width="17" height="12.5" rx="1.5" />
      <rect x="6.5" y="10.5" width="5" height="4" rx="1" />
      <circle cx="16" cy="15.5" r="2" />
    </Glyph>
  ),
  // The last cards: Locking a Tab, the two Tools cleanups, and the three
  // User Interface guides. With these the catalogue is fully drawn, and the
  // category fallback becomes a safety net for cards not yet written rather than
  // something a reader actually sees.
  // Two panes side by side, a tab on each, and the seam between them: the split, not a single tab.
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
  // An element snapped onto the grid, with the nudge that put it there. Drawn as
  // bars on a baseline it was a bar chart — which is `vote-results` and
  // `bar-and-line-charts` — and drawn as a guide line with two boxes it was
  // `alignment-guides`. The grid of dots is what is left, and it is the right
  // subject anyway: this is the action that snaps to it.
  'auto-align': (
    <Glyph>
      <path d="M4 4h.01M9 4h.01M14.5 4h.01M20 4h.01" />
      <path d="M4 9.5h.01M20 9.5h.01" />
      <path d="M4 14.5h.01M20 14.5h.01" />
      <path d="M4 20h.01M9 20h.01M14.5 20h.01M20 20h.01" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
      <path d="M6.2 6.2l1.6 1.6M17.8 17.8l-1.6-1.6" />
    </Glyph>
  ),
  about: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </Glyph>
  ),
  // The canvas, with its small map and the viewport box inside it.
  minimap: (
    <Glyph>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
      <rect x="13" y="12" width="7" height="6.5" rx="1" />
      <rect x="15" y="13.5" width="3" height="2.5" rx="0.5" />
      <path d="M5.5 7h6M5.5 10h4" />
    </Glyph>
  ),
  // Toggles, because that is what the dialog is: a column of them.
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
  'adding-elements': (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <rect x="6" y="8.5" width="6" height="4.5" rx="1" />
      <path d="M14.5 11l5 2.2-2.1.7-.6 2.1z" />
      <path d="M17.5 6.5h3M19 5v3" />
    </Glyph>
  ),
  'pan-and-zoom': (
    <Glyph>
      <path d="M12 2.5v19M2.5 12h19" />
      <path d="M9.5 5.5L12 3l2.5 2.5M9.5 18.5L12 21l2.5-2.5" />
      <path d="M5.5 9.5L3 12l2.5 2.5M18.5 9.5L21 12l-2.5 2.5" />
    </Glyph>
  ),
  // The pattern itself, which is what the dialog changes.
  'changing-the-background': (
    <Glyph>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M7 9h.01M12 9h.01M17 9h.01M7 12h.01M12 12h.01M17 12h.01M7 15h.01M12 15h.01M17 15h.01" />
    </Glyph>
  ),
  // The dialog's list, with one theme picked. A wheel of hues was the obvious
  // drawing and it rendered as the `pie-chart` glyph exactly; `themes` already
  // owns the paint palette, so what is left to draw is the browsing itself.
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
  // A hierarchy whose branches are tinted differently — the whole feature.
  'multicolour-themes': (
    <Glyph>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2v3.3M6 13.5v-1.5h12v1.5" />
      <circle cx="6" cy="17" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="17" r="2.5" />
    </Glyph>
  ),
  // Two elements, both with handles on them: many things selected at once.
  'multi-select': (
    <Glyph>
      <rect x="3.5" y="4" width="8" height="6" rx="1" />
      <rect x="12.5" y="12" width="8" height="6" rx="1" />
      <path d="M3.5 4h.01M11.5 4h.01M3.5 10h.01M11.5 10h.01" />
      <path d="M12.5 12h.01M20.5 12h.01M12.5 18h.01M20.5 18h.01" />
    </Glyph>
  ),
  // A bookmarked URL as a card: its preview, and the title under it.
  'link-cards': (
    <Glyph>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <rect x="6" y="7.5" width="5" height="5" rx="1" />
      <path d="M13.5 9h4.5M13.5 12h3" />
      <path d="M6 16h12" />
    </Glyph>
  ),
  'choosing-fonts': (
    <Glyph>
      <path d="M3 17.5L8 6.5l5 11" />
      <path d="M5 13.5h6" />
      <path d="M15.5 17.5l3.5-7 3.5 7" />
      <path d="M16.8 14.8h4.4" />
    </Glyph>
  ),
  // Canvas category: Undo / Redo.
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
  'layout-cleanup': (
    <Glyph>
      <Prims prims={lucideLayoutGrid} />
    </Glyph>
  ),
  // Two overlapping panels with the back one showing through.
  'panel-opacity': (
    <Glyph>
      <rect x="3" y="3.5" width="12" height="12" rx="2" />
      <rect x="9" y="8.5" width="12" height="12" rx="2" />
      <path d="M9 12.5h6M9 15.5h6" />
    </Glyph>
  ),
  // A plus appearing beside an element, which is the gesture itself.
  'quick-add-on-hover': (
    <Glyph>
      <rect x="3" y="7" width="10" height="10" rx="1.5" />
      <circle cx="18" cy="6" r="3.5" />
      <path d="M18 4.5v3M16.5 6h3" />
    </Glyph>
  ),
  'alignment-guides': (
    <Glyph>
      <path d="M12 3v18" />
      <rect x="4" y="6" width="6" height="4" rx="1" />
      <rect x="14" y="14" width="6" height="4" rx="1" />
    </Glyph>
  ),
  // The strip across the top of a window, with the menu button's three bars
  // in the corner: what the editor's top row is made of.
  'toolbar-layout': (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="9" y="7" width="9" height="3" rx="1" />
      <path d="M5.5 7.5h1.5M5.5 9.5h1.5" />
    </Glyph>
  ),
  // Canvas guides. The four layer entries are deliberately NOT four variations
  // on a stack of sheets: three of them would be indistinguishable at 24px, so
  // each draws the thing its article is about instead — the stack itself, then
  // an eye, a merge, and a reorder.
  'follow-along': (
    <Glyph>
      <path d="M8 4l6.5 15 1.4-6 6-1.6z" />
      <path d="M4.5 6.5v-2h2M4.5 12.5v-2h2M4.5 18.5v-2h2" />
    </Glyph>
  ),
  notes: (
    <Glyph>
      <rect x="3" y="4" width="11" height="11" rx="1.5" />
      <path d="M6 8h5M6 11h3" />
      <rect x="11" y="12" width="10" height="8" rx="1.5" />
      <path d="M14 15.5h4M14 18h2.5" />
    </Glyph>
  ),
  layers: (
    <Glyph>
      <path d="M12 3l8 4.5-8 4.5-8-4.5z" />
      <path d="M4 12.5l8 4.5 8-4.5" />
      <path d="M4 17l8 4.5 8-4.5" />
    </Glyph>
  ),
  'layers-visibility-and-locking': (
    <Glyph>
      <path d="M2.5 11.5S5.5 6 11 6s8.5 5.5 8.5 5.5S16.5 17 11 17s-8.5-5.5-8.5-5.5z" />
      <circle cx="11" cy="11.5" r="2.5" />
      <rect x="16" y="16.5" width="6" height="5" rx="1" />
      <path d="M17.5 16.5v-1.2a1.5 1.5 0 013 0v1.2" />
    </Glyph>
  ),
  'layers-organising': (
    <Glyph>
      <rect x="4" y="3.5" width="11" height="6" rx="1.5" />
      <rect x="9" y="14.5" width="11" height="6" rx="1.5" />
      <path d="M12 10.5v3M10.5 12l1.5 1.5L13.5 12" />
    </Glyph>
  ),
  'layer-order': (
    <Glyph>
      <rect x="4" y="4" width="12" height="6" rx="1.5" />
      <rect x="4" y="14" width="12" height="6" rx="1.5" />
      <path d="M20 8V3.5M18 5.5l2-2 2 2" />
      <path d="M20 16v4.5M18 18.5l2 2 2-2" />
    </Glyph>
  ),
  size: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h5M8 8v5M8 8l5 5" />
      <path d="M16 16h-5M16 16v-5" />
    </Glyph>
  ),
  rotation: (
    <Glyph>
      <rect x="6.5" y="9" width="11" height="11" rx="1.5" />
      <path d="M6 6.5A7 7 0 0119 5" />
      <path d="M19 1.5V5h-3.5" />
    </Glyph>
  ),
  animations: (
    <Glyph>
      <rect x="10" y="8" width="10" height="8" rx="1.5" />
      <path d="M3 9h4M2 12h5M3 15h4" />
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
      <rect x="4" y="4" width="12" height="12" rx="2" />
    </Glyph>
  ),
  // How an element is drawn: one box whose left half is a clean ruled edge and whose right half is two loose
  // hand-drawn strokes, the crisp and the sketched finish in one outline.
  finish: (
    <Glyph>
      <path d="M12 4H5.5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 5.5 20H12" />
      <path d="M11 3.6q5 -.6 9.2 .6M19.6 3.4q.8 8.4 -.2 17M20.4 19.6q-4.4 .8 -9.2 .2" />
      <path d="M12.4 4.6q4 -.2 7 .4M18.8 5.2q.4 7 -.2 13.6" opacity="0.6" />
    </Glyph>
  ),
  // A selected box with a slim panel of swatches beside it: the panel is what
  // the article is about, so it carries the dots and the selection stays plain.
  'quick-style-panel': (
    <Glyph>
      <rect x="2.5" y="8" width="9" height="8" rx="1.5" strokeDasharray="2 1.5" />
      <rect x="14.5" y="3.5" width="7" height="17" rx="1.5" />
      <circle cx="18" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M16.5 15.5h3M16.5 17.5h3" />
    </Glyph>
  ),
  locking: (
    <Glyph>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
      <path d="M12 14.5v2.5" />
    </Glyph>
  ),
  // A card with small marks along its top-right: the badges an element wears.
  'element-indicators': (
    <Glyph>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M6.5 15.5h7" />
      <circle cx="13.5" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <path d="M16 7.5h3.5v2.6h-1.6l-1.2 1.1v-1.1H16z" />
    </Glyph>
  ),
  // A magnet, not another set of guide lines: `alignment-guides` in the Palette
  // settings already draws those, and two cards showing the same thing is the
  // problem these glyphs exist to solve.
  snapping: (
    <Glyph>
      <Prims prims={lucideMagnet} />
    </Glyph>
  ),
  // Explorer section guides. The Explorer's own CATEGORY glyph is a folder tree, so
  // `folders` has to be a folder that is unmistakably about nesting.
  'list-and-card-views': (
    <Glyph>
      <path d="M3 7h6M3 12h6M3 17h6" />
      <rect x="12.5" y="5" width="8.5" height="6" rx="1.5" />
      <rect x="12.5" y="13" width="8.5" height="6" rx="1.5" />
    </Glyph>
  ),
  // A day-by-day feed: the spine, and what landed against it.
  timeline: (
    <Glyph>
      <path d="M6 3.5v17" />
      <circle cx="6" cy="7.5" r="1.6" />
      <circle cx="6" cy="16.5" r="1.6" />
      <path d="M9.5 7.5h9M9.5 16.5h6" />
      <path d="M9.5 12h4" />
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
  // One folder inside another, which is the whole point of a nestable tree.
  folders: (
    <Glyph>
      <path d="M2.5 6.5A1.5 1.5 0 014 5h3.5L9 6.5h4A1.5 1.5 0 0114.5 8v2" />
      <path d="M2.5 6.5v10A1.5 1.5 0 004 18h4" />
      <path d="M9 12.5A1.5 1.5 0 0110.5 11h2l1.5 1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 019 19z" />
    </Glyph>
  ),
  // A new document dropping into its folder: where things go without being told.
  'default-folders': (
    <Glyph>
      <path d="M3 10.5A1.5 1.5 0 014.5 9h3L9 10.5h10.5A1.5 1.5 0 0121 12v6.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5z" />
      <path d="M12 3v8.5" />
      <path d="M9 8.5l3 3 3-3" />
    </Glyph>
  ),
  // A funnel: a list, narrowed.
  filters: (
    <Glyph>
      <path d="M3 4.5h18l-7 8v6l-4 2v-8z" />
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
  'image-gallery': (
    <Glyph>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-7 7" />
    </Glyph>
  ),
  // Tabs guides.
  'tab-folders': (
    <Glyph>
      <path d="M3 7a2 2 0 0 1 2-2h3l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </Glyph>
  ),
  'linking-tabs': (
    <Glyph>
      <Prims prims={lucideLink} />
    </Glyph>
  ),
  'add-to-document': (
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
  // A stack of cards with a shape on the top one: a set of shapes that is yours.
  // A diagram's box and decision, joined by a bent connector, arriving as a document.
  // A board's ink arriving in a tab.
  'export-tabs': (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 14V4M9 7l3-3 3 3" />
    </Glyph>
  ),
  'tab-cleanup': (
    <Glyph>
      <Prims prims={lucideBrushCleaning} />
    </Glyph>
  ),
  // Search Panel guides. Six articles about one control, so by the rule the
  // Behaviour batch settled on, none of these draws a magnifier — `the-search-
  // panel` below already does. Each draws WHAT you find: documents, a team, a tab
  // and an element, a shape landing on the canvas, a new tab.
  'command-palette': (
    <Glyph>
      <rect x="2.5" y="7" width="19" height="10" rx="2.5" />
      <path d="M6 10.5l2 1.5-2 1.5" />
      <path d="M11 13.5h7" />
    </Glyph>
  ),
  'search-documents': (
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
  'search-add-to-canvas': (
    <Glyph>
      <Prims prims={lucideSquarePlus} />
    </Glyph>
  ),
  // A new tab, opened from the panel.
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
  'colours-borders-opacity': (
    <Glyph>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" strokeDasharray="3 2" />
      <path d="M7 17L17 7v10z" fill="currentColor" stroke="none" opacity="0.35" />
    </Glyph>
  ),
  'formatting-label-text': (
    <Glyph>
      <path d="M4 3.5h4.5a2.5 2.5 0 010 5H4zM4 8.5h5a2.75 2.75 0 010 5.5H4z" />
      <path d="M14 5h7M14 9h7M14 13h5" />
      <circle cx="5" cy="18.5" r="1" fill="currentColor" stroke="none" />
      <path d="M8 18.5h13" />
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
 *  (`palette/tools/images`) inherits its top-level category's glyph
 *  rather than needing its own. Adding a bespoke entry to FEATURE_ICONS still
 *  wins — this is the floor, not a replacement for drawing the specific thing.
 */
export const FEATURE_CATEGORY_ICONS: Record<string, ReactNode> = {
  // A window with a title bar: the chrome around everything else.
  'user-interface': (
    <Glyph>
      <Prims prims={lucideAppWindow} />
    </Glyph>
  ),
  // A frame with shapes drawn inside it.
  canvas: (
    <Glyph>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6.5" y="8" width="5" height="4" rx="1" />
      <circle cx="16" cy="14.5" r="2.5" />
    </Glyph>
  ),
  // Stacked swatches: the palette is a catalogue you pick from.
  palette: (
    <Glyph>
      <rect x="3.5" y="4" width="8" height="6" rx="1.5" />
      <rect x="12.5" y="4" width="8" height="6" rx="1.5" />
      <rect x="3.5" y="14" width="8" height="6" rx="1.5" />
      <rect x="12.5" y="14" width="8" height="6" rx="1.5" />
    </Glyph>
  ),
  // Two sheets behind a front one.
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
  'selection-modes': (
    <Glyph>
      <path d="M4 7V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V7M20 15v3.5a1.5 1.5 0 01-1.5 1.5H16" />
      <path d="M4 12v3" />
      <path d="M9 11l6.5 3-2.7 1 1.6 3-1.6.8-1.6-3-1.9 1.9z" />
    </Glyph>
  ),
};
