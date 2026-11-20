// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the palette strip across the
// top of the canvas, and a category's flyout opening under it. The strip itself is the chrome kit's
// (./editor-chrome), drawn the way apps/live ToolbarPalette lays it out.

import { Label, Panel, Scene, Tile } from '@liveworkspace/help-site/art/primitives';
import { DesignPage, EditorFrame, stripCategory, stripX } from './editor-chrome';
import { PhoneScreen } from './design-content';

// The flyout's tiles, drawn as the simple outlines the real tiles use.
function ShapeGlyph({
  kind,
}: {
  kind:
    | 'square'
    | 'circle'
    | 'diamond'
    | 'triangle'
    | 'cylinder'
    | 'parallelogram'
    | 'hexagon'
    | 'star';
}) {
  const s = {
    className: 'stroke-slate-600',
    strokeWidth: 1,
    fill: 'none',
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'square':
      return <rect x={-6} y={-6} width={12} height={12} rx={1.5} {...s} />;
    case 'circle':
      return <circle r={6.5} {...s} />;
    case 'diamond':
      return <path d="M0 -7 L7 0 L0 7 L-7 0 Z" {...s} />;
    case 'triangle':
      return <path d="M0 -6.5 L7 6 H-7 Z" {...s} />;
    case 'cylinder':
      return (
        <path
          d="M-6 -4.5 a6 2.2 0 0 0 12 0 a6 2.2 0 0 0 -12 0 V4.5 a6 2.2 0 0 0 12 0 V-4.5"
          {...s}
        />
      );
    case 'parallelogram':
      return <path d="M-3.5 -5.5 H7 L3.5 5.5 H-7 Z" {...s} />;
    case 'hexagon':
      return <path d="M-3.5 -6 H3.5 L7 0 L3.5 6 H-3.5 L-7 0 Z" {...s} />;
    case 'star':
      return (
        <path
          d="M0 -7 L2 -2.2 L7 -2 L3 1.2 L4.4 6.4 L0 3.4 L-4.4 6.4 L-3 1.2 L-7 -2 L-2 -2.2 Z"
          {...s}
        />
      );
  }
}

/** Shapes open: its flyout hangs under the strip with the shape tiles in named groups, over a tab of pages. */
export function ToolbarCategoryFlyout() {
  const groups = [
    { title: 'Basics', tiles: ['square', 'circle', 'diamond', 'triangle'] as const },
    { title: 'More', tiles: ['star', 'hexagon', 'parallelogram', 'cylinder'] as const },
  ];
  const shapes = stripCategory(stripX(), 'Shapes');
  const px = shapes.left - 4;
  return (
    <Scene w={640} h={330}>
      <EditorFrame
        w={640}
        h={330}
        open="Shapes"
        level="60%"
        over={
          <Panel x={px} y={38} w={152} h={118} title="Shapes">
            {groups.map((g, gi) => (
              <g key={g.title}>
                <Label x={px + 10} y={70 + gi * 44} size={9} weight={500} tone="muted">
                  {g.title}
                </Label>
                {g.tiles.map((kind, i) => (
                  <Tile key={kind} x={px + 10 + i * 34} y={78 + gi * 44} size={28}>
                    <ShapeGlyph kind={kind} />
                  </Tile>
                ))}
              </g>
            ))}
          </Panel>
        }
      >
        <DesignPage x={330} y={80} w={110} h={200} size="iPhone · Wireframe">
          <PhoneScreen x={337} y={87} w={96} h={186} variant="home" cta="Shop Now" frame={false} />
        </DesignPage>
      </EditorFrame>
    </Scene>
  );
}
