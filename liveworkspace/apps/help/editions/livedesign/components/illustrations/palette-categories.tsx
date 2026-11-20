// Scenes for the palette's Popular and Stickers articles: the palette body
// (as More opens it) showing each category. Tile captions are the real ones (palette-tile-defs `caption`, or
// the label less "Add"), Popular's twelve come from palette-layouts, the sticker badges from
// packages/icons/src/sticker-catalog.ts, and the technology marks from tech-icon-catalog.ts.

import type { ReactNode } from 'react';
import { Label, Panel, Scene } from '@liveworkspace/help-site/art/primitives';
import { Strip } from './editor-chrome';

/** The palette strip across the top with `category` pressed, and its flyout hanging under it: the category's
 *  name in the flyout's title row, then the body. The scene's right edge crops the strip. */
function PaletteFrame({
  category,
  h,
  children,
}: {
  category: string;
  h: number;
  children: ReactNode;
}) {
  return (
    <g>
      <Strip x={8} y={8} open={category} />
      <Panel x={60} y={40} w={300} h={h - 30} title={category}>
        {children}
      </Panel>
    </g>
  );
}

/** A search field inside the palette body. */
function SearchField({ y, text, w = 276 }: { y: number; text: string; w?: number }) {
  return (
    <g>
      <rect
        x={72}
        y={y}
        width={w}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.75}
      />
      <circle
        cx={86}
        cy={y + 11}
        r={4.5}
        className="fill-none stroke-slate-400"
        strokeWidth={1.5}
      />
      <path
        d={`M89.5 ${y + 14.5} L93 ${y + 18}`}
        className="stroke-slate-400"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Label x={100} y={y + 12} size={10} tone="muted">
        {text}
      </Label>
    </g>
  );
}

/** The Icons | Stickers switch beside the search field, `side` pressed. */
function SideSwitch({ y, side }: { y: number; side: 'Icons' | 'Stickers' }) {
  const x = 252;
  const half = 48;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={half * 2}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={0.75}
      />
      {(['Icons', 'Stickers'] as const).map((name, i) => (
        <g key={name}>
          {name === side ? (
            <rect
              x={x + 2 + i * half}
              y={y + 2}
              width={half - 4}
              height={20}
              rx={5}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
          ) : null}
          <Label
            x={x + half / 2 + i * half}
            y={y + 12}
            anchor="middle"
            size={9.5}
            weight={name === side ? 600 : 400}
            tone={name === side ? 'strong' : 'muted'}
          >
            {name}
          </Label>
        </g>
      ))}
    </g>
  );
}

/** Stickers: the Icons category turned to its Stickers side, the badges and the emoji on die-cut plates. */
export function StickersSheet() {
  const emoji = ['👍', '🎉', '🔥', '❤️', '✅', '⚠️', '🚀', '💡'];
  const badges = [
    { text: 'APPROVED', fill: 'fill-emerald-500' },
    { text: 'BLOCKED', fill: 'fill-rose-500' },
  ];
  return (
    <Scene w={420} h={262}>
      <PaletteFrame category="Icons" h={244}>
        <SearchField y={76} w={172} text="Search icons and stickers" />
        <SideSwitch y={76} side="Stickers" />
        {/* Stickers keep their own colours in either appearance. */}
        <g className="help-art-as-drawn">
          {badges.map((b, i) => {
            const tx = 76 + i * 136;
            return (
              <g key={b.text}>
                <rect
                  x={tx}
                  y={115}
                  width={128}
                  height={36}
                  rx={14}
                  className="fill-slate-900/15"
                />
                <rect
                  x={tx}
                  y={112}
                  width={128}
                  height={36}
                  rx={14}
                  className="fill-white stroke-slate-200"
                  strokeWidth={0.75}
                />
                <rect x={tx + 7} y={118} width={114} height={24} rx={10} className={b.fill} />
                <Label x={tx + 64} y={131} anchor="middle" size={11} weight={700} tone="onAccent">
                  {b.text}
                </Label>
              </g>
            );
          })}
          {emoji.map((glyph, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const tx = 82 + col * 68;
            const ty = 160 + row * 42;
            return (
              <g key={glyph}>
                <rect
                  x={tx}
                  y={ty + 2}
                  width={36}
                  height={36}
                  rx={11}
                  className="fill-slate-900/15"
                />
                <rect
                  x={tx}
                  y={ty}
                  width={36}
                  height={36}
                  rx={11}
                  className="fill-white stroke-slate-200"
                  strokeWidth={0.75}
                />
                <text
                  x={tx + 18}
                  y={ty + 18}
                  fontSize={19}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {glyph}
                </text>
              </g>
            );
          })}
        </g>
      </PaletteFrame>
    </Scene>
  );
}
