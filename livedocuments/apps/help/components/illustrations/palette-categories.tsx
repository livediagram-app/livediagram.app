// Scenes for the palette's Stickers article: a category's flyout hanging under the palette strip, its button
// pressed on the category bar. The sticker badges come from packages/icons/src/sticker-catalog.ts.

import type { ReactNode } from 'react';
import { Label, Panel, Scene } from '@liveworkspace/help-site/art/primitives';
import { STRIP_W, Strip } from './toolbar-layout';

/** The palette strip with `category` pressed on its bar, and that category's flyout under it, `h` tall from the
 *  strip's top: the category's name, then its body. */
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
      <Strip x={(420 - STRIP_W) / 2} y={8} open={category} />
      <Panel x={60} y={48} w={300} h={h - 38} title={category.toUpperCase()}>
        {children}
      </Panel>
    </g>
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
        strokeWidth={1.5}
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
    <Scene w={420} h={262} bg="plain">
      <PaletteFrame category="Stickers" h={244}>
        <SearchField y={76} text="Search stickers" />
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
                  strokeWidth={1.5}
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
