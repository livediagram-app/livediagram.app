// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top of the
// canvas as the category bar, and a category's flyout opening under it. The strip, the logo and menu cards and the
// corner card are the editor chrome kit's (./editor-chrome), the flyout ./palette-flyout's.

import { Scene } from '@liveworkspace/help-site/art/primitives';
import { stripSlot, TopRow, topRowStripX } from './editor-chrome';
import { Flyout, FlyoutGroup, FlyoutTile } from './palette-flyout';

/** A shape tile's outline, about 18 units across, centred on the origin. */
export function ShapeOutline({
  kind,
}: {
  kind:
    | 'rectangle'
    | 'rounded'
    | 'ellipse'
    | 'diamond'
    | 'triangle'
    | 'hexagon'
    | 'star'
    | 'arrow'
    | 'speech'
    | 'cloud';
}) {
  const s = {
    className: 'fill-brand-50 stroke-brand-500',
    strokeWidth: 1.1,
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'rectangle':
      return <rect x={-9} y={-6.5} width={18} height={13} {...s} />;
    case 'rounded':
      return <rect x={-9} y={-6.5} width={18} height={13} rx={3.5} {...s} />;
    case 'ellipse':
      return <ellipse rx={9} ry={6.5} {...s} />;
    case 'diamond':
      return <path d="M0 -8 L9 0 L0 8 L-9 0 Z" {...s} />;
    case 'triangle':
      return <path d="M0 -7.5 L9 7 H-9 Z" {...s} />;
    case 'hexagon':
      return <path d="M-4.5 -7 H4.5 L9 0 L4.5 7 H-4.5 L-9 0 Z" {...s} />;
    case 'star':
      return (
        <path
          d="M0 -8.5 L2.5 -2.8 L8.6 -2.6 L3.9 1.3 L5.4 7.4 L0 4 L-5.4 7.4 L-3.9 1.3 L-8.6 -2.6 L-2.5 -2.8 Z"
          {...s}
        />
      );
    case 'arrow':
      return <path d="M-9 -3 H2 V-7 L9 0 L2 7 V3 H-9 Z" {...s} />;
    case 'speech':
      return <path d="M-9 -6.5 H9 V3.5 H-1 L-5 7.5 V3.5 H-9 Z" {...s} />;
    case 'cloud':
      return (
        <path
          d="M-5 6 a4 4 0 0 1 -1 -7.8 a5 5 0 0 1 9.4 -2 a4 4 0 0 1 4.6 4.8 a2.6 2.6 0 0 1 -0.6 5 Z"
          {...s}
        />
      );
  }
}

/** A category open: resting on Shapes hangs its flyout under it, its tiles in named groups. */
export function ToolbarCategoryFlyout() {
  const W = 470;
  const cx = stripSlot(topRowStripX(W), 'shapes');
  const fw = 226;
  const fx = Math.round(cx - fw / 2);
  const groups = [
    {
      name: 'Basics',
      tiles: [
        ['rectangle', 'Square'],
        ['rounded', 'Rounded'],
        ['ellipse', 'Circle'],
        ['diamond', 'Diamond'],
        ['triangle', 'Triangle'],
      ],
    },
    {
      name: 'More Shapes',
      tiles: [
        ['hexagon', 'Hexagon'],
        ['star', 'Star'],
        ['arrow', 'Arrow'],
        ['speech', 'Speech'],
        ['cloud', 'Cloud'],
      ],
    },
  ] as const;
  return (
    <Scene w={W} h={240}>
      <TopRow w={W} open="shapes" />
      <Flyout
        x={fx}
        y={40}
        w={fw}
        h={192}
        item="shapes"
        blurb="Boxes, circles and outlines"
        count={24}
      >
        {groups.map((g, gi) => (
          <g key={g.name}>
            <FlyoutGroup x={fx + 10} y={84 + gi * 66} w={fw - 20} name={g.name} />
            {g.tiles.map(([kind, name], i) => (
              <FlyoutTile
                key={kind}
                x={fx + 11 + i * 41.5}
                y={91 + gi * 66}
                w={37}
                name={name}
                hover={gi === 0 && i === 1}
              >
                <ShapeOutline kind={kind} />
              </FlyoutTile>
            ))}
          </g>
        ))}
      </Flyout>
    </Scene>
  );
}
