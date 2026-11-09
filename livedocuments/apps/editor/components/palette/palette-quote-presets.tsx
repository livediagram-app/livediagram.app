import { Glyph } from '@livedocuments/ui';
import type { PaletteTileDef } from './palette-tile-defs';

// The quote's presets (docs/specs/009-elements/quote.md "In the palette"): the Testimonial (a Card with a portrait, a
// name and a role) and the Pull Quote (Plain, words and a name). Like the Card's, they live under their tile, so the
// Components count and Search keep the one Quote.

/** The quote tile's glyph: a mark over lines, a portrait dot below. */
export function QuoteTileGlyph() {
  return (
    <Glyph size={18} units={24}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <path d="M6 7.5c0-1 .6-1.6 1.6-1.6M9.4 7.5c0-1 .6-1.6 1.6-1.6" strokeWidth="1.7" />
      <path d="M6 11h12M6 13.6h9" />
      <circle cx="7" cy="17.2" r="1.3" />
      <path d="M10 17.2h6" />
    </Glyph>
  );
}

function PullQuoteGlyph() {
  return (
    <Glyph size={18} units={24}>
      <path d="M4 7.5c0-1.4.9-2.3 2.3-2.3M8.6 7.5c0-1.4.9-2.3 2.3-2.3" strokeWidth="1.8" />
      <path d="M4 11.5h16M4 14.5h13M4 17.5h10" />
    </Glyph>
  );
}

const preset = (
  variant: string | undefined,
  caption: string,
  blurb: string,
  description: string,
  icon: React.ReactNode,
): PaletteTileDef => ({
  id: `components:quote${variant ? `-${variant}` : ''}`,
  section: 'components',
  caption,
  label: `Add ${caption}`,
  blurb,
  description,
  noTint: true,
  action: { type: 'shape', kind: 'quote', ...(variant ? { variant } : {}) },
  icon,
});

export const QUOTE_PRESET_TILES: readonly PaletteTileDef[] = [
  preset(
    undefined,
    'Testimonial',
    'Words in a card, with a portrait, name and role',
    'Testimonial. A quote in its own card, with the speaker’s portrait, name and role beneath.',
    <QuoteTileGlyph />,
  ),
  preset(
    'pull',
    'Pull Quote',
    'Large words with a name, no box',
    'Pull quote. Large words straight on the page with a name beneath, to lift one line out of a story.',
    <PullQuoteGlyph />,
  ),
];
