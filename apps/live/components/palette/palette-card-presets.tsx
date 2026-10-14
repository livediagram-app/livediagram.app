import { Glyph } from '@livediagram/ui';
import type { PaletteTileDef } from './palette-tile-defs';

// The Card tile's presets (docs/specs/009-elements/card.md "Card presets"): what its opener shows on the Toolbar strip,
// each one an ordinary card tile carrying its variant (packages/document shape-variants.ts `cardPreset`). Not in
// PALETTE_TILES: they live under the Card tile, so a category's tile count and Search keep the one Card.

const preset = (
  variant: string | undefined,
  caption: string,
  blurb: string,
  description: string,
  icon: React.ReactNode,
): PaletteTileDef => ({
  id: `components:card${variant ? `-${variant}` : ''}`,
  section: 'components',
  caption,
  label: `Add ${caption} Card`,
  blurb,
  description,
  filled: true,
  action: { type: 'shape', kind: 'card', ...(variant ? { variant } : {}) },
  icon: (
    <Glyph size={18} units={24}>
      {icon}
    </Glyph>
  ),
});

export const CARD_PRESET_TILES: readonly PaletteTileDef[] = [
  preset(
    undefined,
    'Service',
    'Icon, title, meta, body and tags',
    'Service card. An icon tile, a title and meta line, a body and tags: a service or component node.',
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <rect x="5.5" y="6.5" width="4.5" height="4.5" rx="1.2" />
      <path d="M12.5 7.5h6M12.5 10h4M5.5 14h13" />
      <rect x="5.5" y="16.5" width="4" height="1.6" rx="0.8" />
      <rect x="11" y="16.5" width="4" height="1.6" rx="0.8" />
    </>,
  ),
  preset(
    'compact',
    'Compact',
    'Icon, title and meta on one row',
    'Compact card. An icon tile with a title and meta line beside it: a dense node for architecture diagrams.',
    <>
      <rect x="2.5" y="7" width="19" height="10" rx="2.5" />
      <rect x="5" y="9.5" width="5" height="5" rx="1.2" />
      <path d="M12.5 10.5h6M12.5 13.5h4" />
    </>,
  ),
  preset(
    'panel',
    'Panel',
    'Header band with a badge',
    'Panel card. A coloured header band with a badge, title and meta line over a body.',
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <circle cx="6.5" cy="6.5" r="1.4" fill="currentColor" />
      <path d="M9.5 6.5h6M5.5 13h13M5.5 16h9" />
    </>,
  ),
  preset(
    'person',
    'Person',
    'Initial, name, role and a line',
    'Person card. An initial avatar, a name and role, a line about them and a tag: a persona or a team member.',
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" />
      <circle cx="8" cy="9" r="2.6" />
      <path d="M12.5 8h6M12.5 10.5h4M5.5 15h13" />
    </>,
  ),
  preset(
    'accent',
    'Accent',
    'A coloured edge, title and body',
    'Accent card. A coloured edge down the left with a title and body: colour-code nodes by team or status.',
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M5 5.5v13" strokeWidth="2.6" />
      <path d="M8.5 9h9M8.5 12.5h7M8.5 15.5h5" />
    </>,
  ),
  preset(
    'callout',
    'Callout',
    'A note with an icon badge',
    'Callout card. A soft note with an icon badge, a heading and a body: a tip or a warning.',
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="7" cy="10" r="2" />
      <path d="M11 10h7M7 14.5h11" />
    </>,
  ),
];
