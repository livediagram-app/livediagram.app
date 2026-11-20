import type { ReactNode } from 'react';
import { Arrow, Cursor, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';
import { STRIP_W, Strip } from '../illustrations/editor-chrome';
import { PageTag } from '../illustrations/doc-page';
import { CategoryPanel } from '../illustrations/palette-flyout';

const S = 'fill-none stroke-slate-500';

// One tile per component, in the Components category's order (Palette Tools): Hero, Header, Banner, Stack, Card,
// Badge, Step Number, Callout and Stat Row, each drawn about its tile's centre.
const TILES: { name: string; glyph: (cx: number, cy: number) => ReactNode }[] = [
  {
    name: 'Hero',
    glyph: (cx, cy) => (
      <>
        <rect
          x={cx - 13}
          y={cy - 9}
          width={26}
          height={18}
          rx={2}
          className={S}
          strokeWidth={1.3}
        />
        <rect x={cx - 9} y={cy - 5} width={14} height={3} rx={1.5} className="fill-slate-500" />
        <rect x={cx - 9} y={cy + 2} width={8} height={4} rx={2} className="fill-brand-400" />
      </>
    ),
  },
  {
    name: 'Header',
    glyph: (cx, cy) => (
      <>
        <rect x={cx - 13} y={cy - 7} width={26} height={6} rx={1.5} className="fill-slate-400" />
        <rect x={cx - 13} y={cy + 2} width={18} height={2.5} rx={1.2} className="fill-slate-300" />
        <rect x={cx - 13} y={cy + 6} width={22} height={2.5} rx={1.2} className="fill-slate-300" />
      </>
    ),
  },
  {
    name: 'Banner',
    glyph: (cx, cy) => (
      <>
        <rect x={cx - 14} y={cy - 6} width={28} height={12} rx={2} className="fill-brand-400" />
        <rect
          x={cx - 9}
          y={cy - 1.5}
          width={18}
          height={3}
          rx={1.5}
          className="fill-white help-art-as-drawn"
        />
      </>
    ),
  },
  {
    name: 'Stack',
    glyph: (cx, cy) => (
      <>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={cx - 11}
            y={cy - 9 + i * 6.5}
            width={22}
            height={5}
            rx={1.5}
            className={S}
            strokeWidth={1.2}
          />
        ))}
      </>
    ),
  },
  {
    name: 'Card',
    glyph: (cx, cy) => (
      <>
        <rect
          x={cx - 10}
          y={cy - 10}
          width={20}
          height={20}
          rx={2.5}
          className={S}
          strokeWidth={1.3}
        />
        <rect x={cx - 10} y={cy - 10} width={20} height={8} rx={2.5} className="fill-violet-200" />
        <rect x={cx - 6} y={cy + 2} width={12} height={2.5} rx={1.2} className="fill-slate-400" />
      </>
    ),
  },
  {
    name: 'Badge',
    glyph: (cx, cy) => (
      <rect
        x={cx - 11}
        y={cy - 5}
        width={22}
        height={10}
        rx={5}
        className="fill-emerald-200 stroke-emerald-500"
        strokeWidth={1.2}
      />
    ),
  },
  {
    name: 'Step Number',
    glyph: (cx, cy) => (
      <>
        <circle cx={cx} cy={cy} r={8} className="fill-brand-500" />
        <rect
          x={cx - 1}
          y={cy - 4}
          width={2.2}
          height={8}
          rx={1}
          className="fill-white help-art-as-drawn"
        />
      </>
    ),
  },
  {
    name: 'Callout',
    glyph: (cx, cy) => (
      <>
        <rect
          x={cx - 13}
          y={cy - 8}
          width={26}
          height={16}
          rx={3}
          className="fill-amber-50 stroke-amber-400"
          strokeWidth={1.2}
        />
        <rect x={cx - 13} y={cy - 8} width={3.5} height={16} rx={1.5} className="fill-amber-400" />
        <rect x={cx - 6} y={cy - 2.5} width={14} height={2.5} rx={1.2} className="fill-amber-500" />
      </>
    ),
  },
  {
    name: 'Stat Row',
    glyph: (cx, cy) => (
      <>
        {[-9, 0, 9].map((dx) => (
          <g key={dx}>
            <rect
              x={cx + dx - 3}
              y={cy - 6}
              width={6}
              height={7}
              rx={1}
              className="fill-slate-500"
            />
            <rect
              x={cx + dx - 3}
              y={cy + 3}
              width={6}
              height={2.5}
              rx={1}
              className="fill-slate-300"
            />
          </g>
        ))}
      </>
    ),
  },
];

// Palette: the strip as it is on a slide, with Components open, its tiles, and a Callout on its way from the panel
// onto the slide.
export function PaletteArt() {
  return (
    <Stage>
      <Strip x={(400 - STRIP_W) / 2} y={14} open="components" />

      {/* The Components panel. */}
      <CategoryPanel x={40} y={52} w={170} h={132} item="components">
        {TILES.map((t, i) => {
          const tx = 50 + (i % 3) * 52;
          const ty = 74 + Math.floor(i / 3) * 34;
          const on = t.name === 'Callout';
          return (
            <g key={t.name}>
              <rect
                x={tx}
                y={ty}
                width={46}
                height={30}
                rx={6}
                className={on ? 'fill-brand-50 stroke-brand-400' : 'fill-slate-50 stroke-slate-200'}
                strokeWidth={on ? 1.25 : 0.75}
              />
              {t.glyph(tx + 23, ty + 15)}
            </g>
          );
        })}
      </CategoryPanel>

      {/* The slide it lands on. */}
      <Card x={232} y={66} w={150} h={86} r={4}>
        <rect x={232} y={66} width={6} height={86} rx={2} className="fill-brand-500" />
        <rect x={248} y={78} width={66} height={7} rx={3.5} className="fill-slate-700" />
        <rect x={248} y={90} width={48} height={4} rx={2} className="fill-slate-300" />
        <rect
          x={248}
          y={106}
          width={84}
          height={34}
          rx={5}
          className="fill-amber-50 stroke-amber-300"
          strokeWidth={1.2}
        />
        <rect x={248} y={106} width={5} height={34} rx={2} className="fill-amber-400" />
        <rect x={260} y={115} width={44} height={5} rx={2.5} className="fill-amber-500" />
        <rect x={260} y={126} width={60} height={4} rx={2} className="fill-amber-200" />
      </Card>
      <PageTag x={232} bottom={63} name="Results" />
      <Arrow from={[178, 152]} to={[240, 126]} kind="curved" dashed tone="muted" width={2} />
      <SelectionBox x={244} y={102} w={92} h={42} />
      <Cursor x={318} y={132} colour="brand" />
    </Stage>
  );
}
