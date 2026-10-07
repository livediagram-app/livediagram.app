// Scenes for the palette's Popular, Write, Stickers and Technology articles: the floating palette
// showing each category's body. Tile captions are the real ones (palette-tile-defs `caption`, or
// the label less "Add"), Popular's twelve come from palette-layouts, the sticker badges from
// packages/icons/src/sticker-catalog.ts, and the technology marks from tech-icon-catalog.ts.

import type { ReactNode } from 'react';
import { Label, Panel, Scene, Tile } from './primitives';

/** The floating palette: its title bar, then the header band (selection mode on the left, the
 *  category picker on the right) the body hangs under. */
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
    <Panel x={60} y={10} w={300} h={h} title="PALETTE">
      {/* Selection mode picker */}
      <rect
        x={72}
        y={42}
        width={40}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-100"
        strokeWidth={1}
      />
      <path
        d="M80 48 L80 60 L83.5 57 L85.5 61 L87.5 60 L85.5 56 L89.5 55.5 Z"
        className="fill-brand-600"
      />
      <path
        d="M100 52 l3 3 l3 -3"
        className="stroke-brand-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      {/* Category picker */}
      <rect
        x={244}
        y={42}
        width={104}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-100"
        strokeWidth={1}
      />
      <Label x={254} y={55} size={10} weight={700} className="fill-brand-700">
        {category}
      </Label>
      <path
        d="M334 52 l3 3 l3 -3"
        className="stroke-brand-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      {children}
    </Panel>
  );
}

const g = {
  className: 'fill-none stroke-slate-500',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Diagram mode's Popular, in its own order (palette-layouts DIAGRAM).
const POPULAR: { label: string; glyph: ReactNode }[] = [
  { label: 'Square', glyph: <rect x={-6} y={-6} width={12} height={12} rx={2} {...g} /> },
  { label: 'Circle', glyph: <circle r={6.5} {...g} /> },
  { label: 'Diamond', glyph: <path d="M0 -7 L7 0 L0 7 L-7 0 Z" {...g} /> },
  { label: 'Text', glyph: <path d="M-5 -5h10M0 -5v11" {...g} /> },
  { label: 'Arrow', glyph: <path d="M-6 6 L6 -6 M0 -6 H6 V0" {...g} /> },
  {
    label: 'Frame',
    glyph: <path d="M-3 -7 V7 M3 -7 V7 M-7 -3 H7 M-7 3 H7" {...g} />,
  },
  { label: 'Note', glyph: <path d="M-6 -6 h12 v7 l-5 5 h-7 Z M1 6 v-5 h5" {...g} /> },
  {
    label: 'Image',
    glyph: (
      <g {...g}>
        <rect x={-7} y={-6} width={14} height={12} rx={2} />
        <path d="M-7 3 L-2 -1 L2 2 L4 0 L7 3" />
      </g>
    ),
  },
  {
    label: 'Shape Pen',
    glyph: (
      <g {...g}>
        <path d="M-6 6 L-5 2 L3 -6 L6 -3 L-2 5 Z" />
      </g>
    ),
  },
  {
    label: 'Table',
    glyph: (
      <g {...g}>
        <rect x={-7} y={-6} width={14} height={12} rx={1.5} />
        <path d="M-7 -1h14M-1 -6v12" />
      </g>
    ),
  },
  { label: 'Code', glyph: <path d="M-3 -5 L-7 0 L-3 5 M3 -5 L7 0 L3 5" {...g} /> },
  {
    label: 'Entity',
    glyph: (
      <g {...g}>
        <rect x={-7} y={-6} width={14} height={12} rx={1.5} />
        <path d="M-7 -2h14M-4 1.5h6M-4 4h4" />
      </g>
    ),
  },
];

/** Popular in Diagram mode: twelve tiles, four across, with the divider after the Diamond. */
export function PopularGrid() {
  return (
    <Scene w={420} h={250} bg="plain">
      <PaletteFrame category="Popular" h={230}>
        {POPULAR.map((t, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          return (
            <g key={t.label}>
              <Tile x={92 + col * 66} y={84 + row * 50} size={30}>
                {t.glyph}
              </Tile>
              <Label x={107 + col * 66} y={124 + row * 50} size={10} anchor="middle" tone="muted">
                {t.label}
              </Label>
            </g>
          );
        })}
      </PaletteFrame>
    </Scene>
  );
}

/** Write: rows, not tiles, each with the one-line blurb that tells the four apart. */
export function WriteRows() {
  const rows: { name: string; blurb: string; key?: string; glyph: ReactNode }[] = [
    {
      name: 'Page',
      blurb: 'A paper-shaped page for prose',
      glyph: <path d="M-5 -7 h10 v14 h-10 Z M-2.5 -3 h5 M-2.5 0 h5 M-2.5 3 h3" {...g} />,
    },
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
      name: 'Annotation',
      blurb: 'A marker that holds a note',
      glyph: <path d="M-7 -5 h14 v8 h-8 l-3 3 v-3 h-3 Z" {...g} />,
    },
  ];
  return (
    <Scene w={420} h={250} bg="plain">
      <PaletteFrame category="Write" h={230}>
        {rows.map((r, i) => {
          const ry = 80 + i * 40;
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

/** Tech, drilled into AWS: a breadcrumb back to the providers, then three brand tiles across,
 *  each captioned. */
export function TechGrid() {
  const w = {
    className: 'stroke-white',
    strokeWidth: 1.6,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  const tiles: { label: string; fill: string; glyph: ReactNode }[] = [
    {
      label: 'S3',
      fill: 'fill-emerald-500',
      glyph: (
        <path d="M-7 -5 a7 3 0 0 0 14 0 v10 a7 3 0 0 1 -14 0 Z M-7 -5 a7 3 0 0 0 14 0" {...w} />
      ),
    },
    {
      label: 'EC2',
      fill: 'fill-amber-500',
      glyph: (
        <g {...w}>
          <rect x={-6} y={-6} width={12} height={12} rx={1.5} />
          <path d="M-3 -9 V-6 M3 -9 V-6 M-3 6 V9 M3 6 V9" />
        </g>
      ),
    },
    {
      label: 'Lambda',
      fill: 'fill-amber-500',
      glyph: <path d="M-6 7 L-1 -7 M-4 -7 H0 L6 7" {...w} />,
    },
    {
      label: 'RDS',
      fill: 'fill-indigo-500',
      glyph: (
        <path
          d="M-6 -4 a6 3 0 0 0 12 0 v8 a6 3 0 0 1 -12 0 Z M-6 -4 a6 3 0 0 0 12 0 M-6 0 a6 3 0 0 0 12 0"
          {...w}
        />
      ),
    },
    {
      label: 'DynamoDB',
      fill: 'fill-indigo-500',
      glyph: <path d="M-6 -6 H6 V6 H-6 Z M-6 0 H6 M0 -6 V6" {...w} />,
    },
    {
      label: 'API Gateway',
      fill: 'fill-violet-500',
      glyph: <path d="M-7 0 H7 M-3 -5 L-7 0 L-3 5 M3 -5 L7 0 L3 5" {...w} />,
    },
  ];
  return (
    <Scene w={420} h={262} bg="plain">
      <PaletteFrame category="Tech" h={244}>
        <SearchField y={76} text="Search technology" />
        <Label x={76} y={116} size={10} weight={600} tone="accent">
          Tech
        </Label>
        <Label x={102} y={116} size={10} tone="muted">
          ›
        </Label>
        <Label x={114} y={116} size={10} weight={700} tone="strong">
          AWS
        </Label>
        <g className="help-art-as-drawn">
          {tiles.map((t, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const tx = 104 + col * 82;
            const ty = 130 + row * 58;
            return (
              <g key={t.label}>
                <rect x={tx} y={ty} width={36} height={36} rx={8} className={t.fill} />
                <g transform={`translate(${tx + 18} ${ty + 18})`}>{t.glyph}</g>
              </g>
            );
          })}
        </g>
        {tiles.map((t, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <Label
              key={t.label}
              x={122 + col * 82}
              y={176 + row * 58}
              anchor="middle"
              size={10}
              tone="body"
            >
              {t.label}
            </Label>
          );
        })}
      </PaletteFrame>
    </Scene>
  );
}
