'use client';

// The Sankey menu's tile glyphs (docs/specs/009-elements/sankey.md "The menu"): each draws the choice it picks,
// at 24 units, so a tile reads before its label does.

import {
  SANKEY_NEUTRAL_BAND,
  type SankeyAlign,
  type SankeyLeftover,
  type SankeyLinkColor,
  type SankeyValueLabel,
} from '@liveplanner/project';

export function BandGlyph({ mode, from, to }: { mode: SankeyLinkColor; from: string; to: string }) {
  const id = `sk-band-glyph-${mode}`;
  const fill =
    mode === 'gradient'
      ? `url(#${id})`
      : mode === 'source'
        ? from
        : mode === 'target'
          ? to
          : SANKEY_NEUTRAL_BAND;
  return (
    <svg width={22} height={18} viewBox="0 0 24 20" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="1" y="2" width="3" height="10" rx="1" fill={from} />
      <rect x="20" y="8" width="3" height="10" rx="1" fill={to} />
      <path d="M4 2 C12 2 12 8 20 8 L20 18 C12 18 12 12 4 12 Z" fill={fill} fillOpacity={0.6} />
    </svg>
  );
}

export function AlignGlyph({ align }: { align: SankeyAlign }) {
  // Three columns; the short branch ends in the middle column By Step, and in the last when justified.
  const endX = align === 'justify' ? 20 : 11;
  return (
    <svg
      width={22}
      height={18}
      viewBox="0 0 24 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      <path d="M3 4v12M11 3v6M20 11v6" strokeLinecap="round" />
      <path d={`M${endX} 13v4`} strokeLinecap="round" strokeWidth={2.4} />
      <path d="M4 7 C8 7 8 6 11 6 M4 13 C8 13 8 15 20 14" strokeOpacity={0.55} />
    </svg>
  );
}

export function ValueGlyph({ label }: { label: SankeyValueLabel }) {
  const text = label === 'value' ? '1.2k' : label === 'percent' ? '%' : 'Aa';
  return (
    <span className="text-[11px] font-semibold leading-none tabular-nums" aria-hidden>
      {text}
    </span>
  );
}

export function LeftoverGlyph({ leftover, color }: { leftover: SankeyLeftover; color: string }) {
  // A node fed by a wide band and sending on a narrower one; Show draws the rest to a grey end node.
  return (
    <svg width={22} height={18} viewBox="0 0 24 20" aria-hidden>
      <rect x="10" y="3" width="3" height="14" rx="1" fill={color} />
      <path d="M1 3 C6 3 6 3 10 3 L10 17 C6 17 6 17 1 17 Z" fill={color} fillOpacity={0.35} />
      <path d="M13 3 C17 3 17 3 22 3 L22 11 C17 11 17 11 13 11 Z" fill={color} fillOpacity={0.6} />
      {leftover === 'show' ? (
        <>
          <path
            d="M13 11 C17 11 17 15 21 15 L21 17.5 C17 17.5 17 17 13 17 Z"
            fill={SANKEY_NEUTRAL_BAND}
            fillOpacity={0.7}
          />
          <rect x="21" y="14" width="2" height="4" rx="0.5" fill={SANKEY_NEUTRAL_BAND} />
        </>
      ) : null}
    </svg>
  );
}
