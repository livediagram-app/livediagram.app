// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the editor's top row with the
// palette strip as the category bar, its fixed corners, and a category's flyout opening under it. The chrome is the
// kit's (./editor-chrome), the flyout ./palette-flyout's.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  BottomBar,
  CLUSTER_W,
  CornerCluster,
  CORNER_W,
  LOGO_W,
  MENU_W,
  stripSlot,
  TopRow,
  topRowStripX,
} from './editor-chrome';
import { Flyout, FlyoutGroup, FlyoutTile } from './palette-flyout';

/** A Shapes tile's outline, about 18 units across, centred on the origin. */
export function ShapeOutline({
  kind,
}: {
  kind: 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon';
}) {
  const s = {
    className: 'fill-brand-50 stroke-brand-500',
    strokeWidth: 1.1,
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'square':
      return <rect x={-7.5} y={-7.5} width={15} height={15} rx={1.5} {...s} />;
    case 'circle':
      return <circle r={8} {...s} />;
    case 'diamond':
      return <path d="M0 -8.5 L8.5 0 L0 8.5 L-8.5 0 Z" {...s} />;
    case 'triangle':
      return <path d="M0 -7.5 L8.5 7 H-8.5 Z" {...s} />;
    case 'hexagon':
      return <path d="M-4.5 -7.5 H4.5 L9 0 L4.5 7.5 H-4.5 L-9 0 Z" {...s} />;
  }
}

const W = 540;

/** The editor's fixed frame, named: the logo and the menu with the mode switch top-left, the strip (the selection mode,
 *  the categories, Library and Search), Share and Sign In top-right, then the corner cluster and the bottom bar. */
export function ToolbarLayoutOverview() {
  const sx = topRowStripX(W);
  const leader = { className: 'stroke-slate-300', strokeWidth: 0.75 } as const;
  const name = (x: number, text: string, accent = false, y = 54) => (
    <g>
      <line x1={x} y1={38} x2={x} y2={y - 7} {...leader} />
      <Label
        x={x}
        y={y}
        size={9.5}
        anchor="middle"
        weight={accent ? 650 : 500}
        tone={accent ? 'accent' : 'muted'}
      >
        {text}
      </Label>
    </g>
  );
  const H = 200;
  return (
    <Scene w={W} h={H}>
      <TopRow w={W} />
      {name(8 + LOGO_W / 2, 'Logo')}
      {name(8 + LOGO_W + 6 + MENU_W / 2 + 10, 'Menu, mode switch')}
      {name(sx + 17, 'Selection mode', false, 72)}
      {name(stripSlot(sx, 'concepts'), 'Categories', true)}
      {name(stripSlot(sx, 'library') + 12, 'Library, Search', false, 72)}
      {name(W - 8 - CORNER_W / 2, 'Share, Sign In')}
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - 26 - 8 - 24} />
      <Label x={W - 8 - CLUSTER_W - 8} y={H - 46} size={9.5} anchor="end" tone="muted">
        Undo, tidy, layers, theme, zoom
      </Label>
      <BottomBar y={H - 26} w={W} />
      <line x1={30} y1={H - 39} x2={30} y2={H - 22} {...leader} />
      <Label x={14} y={H - 46} size={9.5} tone="muted">
        Tabs along the bottom
      </Label>
    </Scene>
  );
}

/** A category open: resting on Shapes hangs its flyout under it, Basics as a grid and the optional groups as rows. */
export function ToolbarCategoryFlyout() {
  const cx = stripSlot(topRowStripX(W), 'shapes');
  const fw = 252;
  const fx = Math.round(cx - fw / 2);
  const basics = [
    ['square', 'Square'],
    ['circle', 'Circle'],
    ['diamond', 'Diamond'],
    ['triangle', 'Triangle'],
    ['hexagon', 'Hexagon'],
  ] as const;
  const fy = 40;
  return (
    <Scene w={W} h={250}>
      <TopRow w={W} open="shapes" />
      <Flyout
        x={fx}
        y={fy}
        w={fw}
        h={200}
        item="shapes"
        blurb="The basics, the flowchart vocabulary, BPMN and more."
      >
        <FlyoutGroup x={fx + 10} y={fy + 46} w={fw - 20} name="Basics" />
        {basics.map(([kind, label], i) => (
          <FlyoutTile
            key={kind}
            x={fx + 13 + i * 46}
            y={fy + 54}
            w={38}
            name={label}
            hover={i === 2}
          >
            <ShapeOutline kind={kind} />
          </FlyoutTile>
        ))}
        {['Flowchart', 'More Shapes', 'BPMN'].map((g, i) => {
          const ry = fy + 116 + i * 20;
          return (
            <g key={g}>
              <rect
                x={fx + 8}
                y={ry}
                width={fw - 16}
                height={16}
                rx={4}
                className="fill-slate-50"
              />
              <path
                d={`M${fx + 15} ${ry + 5.5} l2.5 2.5 l-2.5 2.5`}
                className="fill-none stroke-slate-500"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Label x={fx + 23} y={ry + 8.5} size={9} weight={600} tone="body">
                {g}
              </Label>
            </g>
          );
        })}
      </Flyout>
    </Scene>
  );
}

/** The editor's top row on its own, each part named under it: the logo, the menu and the mode switch, the palette strip,
 *  then Share and Sign In (or, with `initial`, Share and the account). */
export function TopRowParts({ initial }: { initial?: string }) {
  const sx = topRowStripX(W);
  const leader = { className: 'stroke-slate-300', strokeWidth: 0.75 } as const;
  const name = (x: number, text: string) => (
    <g key={text}>
      <line x1={x} y1={38} x2={x} y2={47} {...leader} />
      <Label x={x} y={54} size={9.5} anchor="middle" weight={500} tone="muted">
        {text}
      </Label>
    </g>
  );
  return (
    <Scene w={W} h={70}>
      <TopRow w={W} initial={initial} />
      {name(8 + LOGO_W / 2, 'Logo')}
      {name(8 + LOGO_W + 6 + 14, 'Menu')}
      {name(8 + LOGO_W + 6 + 60, 'Mode switch')}
      {name(sx + 129, 'Palette')}
      {name(W - 8 - CORNER_W / 2, initial ? 'Share, account' : 'Share, Sign In')}
    </Scene>
  );
}
