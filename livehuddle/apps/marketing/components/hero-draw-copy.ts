// Every word the hero's Draw window writes (components/hero-draw-board.tsx), and every word the landing hero's
// whiteboard writes (components/HeroWhiteboard.tsx, components/HeroConnectors.tsx), in one place, because
// it is all set in a hand face served from our own origin as a subset: public/fonts/caveat-hero.woff2 holds only
// the glyphs in HAND_GLYPHS, so a word that needs another glyph would fall back to a system face.
// hero-draw-copy.test.ts keeps the two in step. To regenerate the subset after changing the copy,
// fetch Google Fonts' css2 API for Caveat at weight 600 with `text=` set to HAND_GLYPHS (send a
// browser User-Agent so it answers with woff2), and save the file its src points at.

export const DRAW_COPY = {
  title: 'What went well?',
  subtitle: 'Sprint retro with the whole team',
  stickies: [
    ['Shipped the', 'beta on time'],
    ['Pairing on', 'the hard bits'],
    ['Fewer, better', 'meetings'],
    ['Docs before', 'code, finally'],
  ],
  keep: 'Do more of this!',
  shoutOuts: 'Shout-outs',
  thanks: ['Maya, for the late save', 'Dev, for the new build', 'Priya, demo day!'],
  chart: 'Velocity',
  gain: 'best yet!',
} as const;

// The landing hero's whiteboard (docs/specs/019-marketing/marketing-site.md "Hero"): its sticky notes, and the
// note scrawled under the search arrow's tip. Only glyphs the subset already carries.
export const WHITEBOARD_COPY = {
  stickies: ['big idea!', 'who owns it?', 'vote on it!'],
  startHere: 'start here',
} as const;

// The characters the subset font carries: exactly the ones DRAW_COPY and WHITEBOARD_COPY use, each glyph about half
// a kilobyte of the font file.
export const HAND_GLYPHS = ' !,-?DFMPSVWabcdefghilmnoprstuvwy';
