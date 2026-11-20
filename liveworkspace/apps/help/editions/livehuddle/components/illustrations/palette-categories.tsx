// Scenes for the palette's Popular, Write and Stickers articles: the palette body
// (as More opens it) showing each category. Tile captions are the real ones (palette-tile-defs `caption`, or
// the label less "Add"), Popular's twelve come from palette-layouts and the sticker badges from
// packages/icons/src/sticker-catalog.ts.

import type { ReactNode } from 'react';
import { Label, Scene, Tile } from '@liveworkspace/help-site/art/primitives';
import { Card, Icon, ICONS } from './editor-chrome';

// Each flyout's line under its name.
const TAGLINES: Record<string, string> = {
  Write: 'Text and sticky notes.',
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
      <Icon
        prims={category === 'Write' ? ICONS.write : SMILE}
        x={79}
        y={29}
        size={11}
        className="stroke-brand-700"
      />
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

const g = {
  className: 'fill-none stroke-slate-500',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Write: rows, not tiles, each with the one-line blurb that tells them apart. */
export function WriteRows() {
  const rows: { name: string; blurb: string; key?: string; glyph: ReactNode }[] = [
    {
      name: 'Text',
      blurb: 'A free-standing text label',
      key: 'T',
      glyph: <path d="M-5 -5h10M0 -5v11" {...g} />,
    },
    {
      name: 'Note',
      blurb: 'A coloured note card',
      key: 'N',
      glyph: <path d="M-6 -6 h12 v7 l-5 5 h-7 Z M1 6 v-5 h5" {...g} />,
    },
    {
      name: 'Image',
      blurb: 'Place an uploaded picture',
      glyph: <path d="M-6 -5 h12 v10 h-12 Z M-6 3 l4 -4 l4 4 l2 -2 l2 2 M2.5 -2 h0.01" {...g} />,
    },
  ];
  return (
    <Scene w={420} h={190} bg="plain">
      <PaletteFrame category="Write" h={176}>
        {rows.map((r, i) => {
          const ry = 62 + i * 40;
          return (
            <g key={r.name}>
              <Tile x={76} y={ry} size={30}>
                {r.glyph}
              </Tile>
              <Label x={118} y={ry + 10} size={11} weight={600} tone="strong">
                {r.name}
              </Label>
              <Label x={118} y={ry + 24} size={10} tone="muted">
                {r.blurb}
              </Label>
              {r.key && (
                <g>
                  <rect
                    x={322}
                    y={ry + 6}
                    width={18}
                    height={18}
                    rx={4}
                    className="fill-slate-50 stroke-slate-200"
                    strokeWidth={1}
                  />
                  <Label x={331} y={ry + 16} size={10} anchor="middle" weight={600} tone="muted">
                    {r.key}
                  </Label>
                </g>
              )}
            </g>
          );
        })}
      </PaletteFrame>
    </Scene>
  );
}

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
