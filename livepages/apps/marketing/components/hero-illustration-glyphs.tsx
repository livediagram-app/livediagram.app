// The hero illustration's glyph vocabulary: the small, stateless pieces the
// editor windows draw themselves out of. Split from HeroIllustration,
// which was over the 1000-line mark and mixed a timed animation with 370
// lines of SVG paths. Every one of these is pure markup with no state, no
// module constants and no reference to another, so they read on their own.
// Glyphs the editor's chrome also draws (the share-state dots, the Tabs label,
// chevrons, menu, search, the canvas cluster and the toolbelt) come from @livepages/ui instead, so the hero
// mirrors the editor rather than a copy of it.

import { lucideShare2 } from '@livepages/icons/lucide';
import { Glyph, GlyphDisc, Prims } from '@livepages/ui';

// A tab's presence avatar, sized as the editor's TabPresenceStack sizes them:
// small initials on the participant's colour, a ring of the bar's own surface, overlapping the
// next one by a hair (the last carries no overlap so the stack sits inside
// the pill's padding).
export function TabAvatar({
  initials,
  color,
  last,
}: {
  initials: string;
  color: string;
  last: boolean;
}) {
  return (
    <GlyphDisc
      size={16}
      style={{ backgroundColor: color }}
      className={`border-2 border-white text-[7px] dark:border-slate-900 font-semibold text-white ${
        last ? '' : '-mr-0.5'
      }`}
    >
      {initials}
    </GlyphDisc>
  );
}

export function ShareGlyph() {
  return (
    <Glyph size={9} units={24}>
      <Prims prims={lucideShare2} />
    </Glyph>
  );
}
