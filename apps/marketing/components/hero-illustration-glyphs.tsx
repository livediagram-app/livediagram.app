// The hero illustration's glyph vocabulary: the small, stateless pieces the
// six editor windows draw themselves out of. Split from HeroIllustration,
// which was over the 1000-line mark and mixed a timed animation with 370
// lines of SVG paths. Every one of these is pure markup with no state, no
// module constants and no reference to another, so they read on their own.
// Glyphs the editor's chrome also draws (the share-state dots, the Tabs label,
// chevrons, menu, search, the canvas cluster and the toolbelt) come from @livediagram/ui instead, so the hero
// mirrors the editor rather than a copy of it.

import { lucideShare2 } from '@livediagram/icons/lucide';
import { Glyph, GlyphDisc, Prims } from '@livediagram/ui';

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

export function Shape({ kind }: { kind: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cyl':
      return (
        <svg {...common}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'para':
      return (
        <svg {...common}>
          <polygon points="4,3 13,3 12,13 3,13" strokeLinejoin="round" />
        </svg>
      );
    case 'hex':
      return (
        <svg {...common}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pill':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M3.5 4h9M8 4v9M6 13h4" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h9M9 4.5 12.5 8 9 11.5" />
        </svg>
      );
    case 'frame':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 5.5V13h10V5.5M3 5.5V3h4l1 2.5h5" />
        </svg>
      );
    case 'note':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 3h10v6l-4 4H3z" />
          <path d="M9 13V9h4" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
          <path d="M2.5 11l3.5-3.5 3 3 2-2 2.5 2.5" />
          <circle cx="10.5" cy="6" r="1" />
        </svg>
      );
    case 'pen':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13c1-4 3-6 6-8l2 2c-2 3-4 5-8 6z" />
          <path d="M9 5l2 2" />
        </svg>
      );
  }
  return null;
}

export function StarGlyph() {
  return (
    <Glyph size={8} units={12} strokeLinecap="butt">
      <path d="M6 1.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1L6 8.6 3.2 10.1l.6-3.1L1.5 4.8l3.1-.4z" />
    </Glyph>
  );
}

// The editor's Share button mark.
export function ShareGlyph() {
  return (
    <Glyph size={9} units={24}>
      <Prims prims={lucideShare2} />
    </Glyph>
  );
}

export function EyeGlyph({ off }: { off: boolean }) {
  return (
    <Glyph size={10} units={16}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
      {off ? <path d="M2.5 13.5l11-11" /> : null}
    </Glyph>
  );
}

// A collaborator's pointer, as the editor draws a teammate's cursor, in their colour.
export function CollaboratorPointer({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill={color} stroke="white" aria-hidden>
      <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
    </svg>
  );
}
