// Scenes for the palette's Popular and Stickers articles: the palette body
// (as More opens it) showing each category. Tile captions are the real ones (palette-tile-defs `caption`, or
// the label less "Add"), Popular's twelve come from palette-layouts and the sticker badges from
// packages/icons/src/sticker-catalog.ts.

import type { ReactNode } from 'react';
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { Card, Icon } from './editor-chrome';

// Each flyout's line under its name.
const TAGLINES: Record<string, string> = {
  Stickers: 'Emoji for reacting and marking status.',
};

/** A category's flyout as the strip hangs it: its head (the category's glyph on a pale tile, its name and its
 *  line) over a hairline, then the category's body. */
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
    <Card x={60} y={10} w={300} h={h} r={7}>
      <rect x={68} y={18} width={22} height={22} rx={5} className="fill-brand-100" />
      <Icon prims={SMILE} x={79} y={29} size={11} className="stroke-brand-700" />
      <Label x={98} y={24} size={10.5} weight={650} tone="strong">
        {category}
      </Label>
      <Label x={98} y={36} size={9} tone="muted">
        {TAGLINES[category] ?? ''}
      </Label>
      <line x1={60} y1={50} x2={360} y2={50} className="stroke-slate-100" strokeWidth={0.75} />
      {children}
    </Card>
  );
}

const SMILE = [
  { t: 'circle', cx: 12, cy: 12, r: 10 },
  { t: 'path', d: 'M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01' },
] as const;

/** A search field inside the palette body. */
function SearchField({ y, text }: { y: number; text: string }) {
  return (
    <g>
      <rect
        x={72}
        y={y}
        width={276}
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

/** Stickers: a search for "approved" finds the badge, and the emoji land on die-cut plates. */
export function StickersSheet() {
  const emoji = ['👍', '🎉', '🔥', '❤️', '✅', '⚠️', '🚀', '💡'];
  const badges = [
    { text: 'APPROVED', fill: 'fill-emerald-500' },
    { text: 'BLOCKED', fill: 'fill-rose-500' },
  ];
  return (
    <Scene w={420} h={250} bg="plain">
      <PaletteFrame category="Stickers" h={232}>
        <SearchField y={62} text="Search stickers" />
        {/* Stickers keep their own colours in either appearance. */}
        <g className="help-art-as-drawn">
          {badges.map((b, i) => {
            const tx = 76 + i * 136;
            return (
              <g key={b.text}>
                <rect
                  x={tx}
                  y={101}
                  width={128}
                  height={36}
                  rx={14}
                  className="fill-slate-900/15"
                />
                <rect
                  x={tx}
                  y={98}
                  width={128}
                  height={36}
                  rx={14}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.5}
                />
                <rect x={tx + 7} y={104} width={114} height={24} rx={10} className={b.fill} />
                <Label x={tx + 64} y={117} anchor="middle" size={11} weight={700} tone="onAccent">
                  {b.text}
                </Label>
              </g>
            );
          })}
          {emoji.map((glyph, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const tx = 82 + col * 68;
            const ty = 146 + row * 42;
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
                  strokeWidth={1.5}
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
