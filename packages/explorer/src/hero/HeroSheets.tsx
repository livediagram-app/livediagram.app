// Home's hero art (the `heroArt` on the right of the hero, from `lg` up), drawn the same wherever the Explorer runs:
// a few white-edged sheets fanned, two behind turned out to either side and two in front, each a picture of what the
// app makes with its name in a chip (liveplanner's Board, Sheet, Dashboard and Form). Each picture is drawn in both
// the light and the dark look, and the page's own appearance shows one, so the art never waits on a theme read.
//
// The pictures come two ways. An app's editor hands its own components (`HeroSheets`). A host that carries none of
// the app's code, as liveworkspace.app, hands the app's hero manifest (`@<app>/templates/hero.json`, generated from
// those same components) to `HeroArt`, which draws its markup as React elements: no HTML is parsed, no handler or
// raw markup prop is taken, and only drawing elements are made.

import { createElement, Fragment, type ReactNode } from 'react';

export type HeroSheet = { id: string; label: string; light: ReactNode; dark: ReactNode };

/** A picture's markup as data: text, or `[tag, props, ...children]` with React's prop names. */
export type HeroArtNode = string | [string, Record<string, unknown> | null, ...HeroArtNode[]];

/** An app's hero art, as its templates package ships it (`hero.json`). */
export type HeroArtManifest = {
  app: string;
  label: string;
  sheets: { id: string; label: string; light: HeroArtNode; dark: HeroArtNode }[];
};

// One sheet: a white-edged card.
const SHEET_FRAME =
  'absolute overflow-hidden rounded-2xl border-[6px] border-white bg-white dark:border-slate-800 dark:bg-slate-800';

/** The four places, in the sheets' order: two behind, turned out to either side, then two in front. */
const SHEET_PLACES = [
  'left-[2%] top-14 h-32 w-[54%] -rotate-[7deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'right-[2%] top-12 h-32 w-[54%] rotate-[6deg] shadow-[0_14px_34px_-14px_rgba(15,23,42,0.35)]',
  'left-[8%] top-[9.75rem] z-10 h-32 w-[50%] -rotate-[2deg] shadow-[0_24px_50px_-18px_color-mix(in_oklab,var(--color-brand-600)_50%,transparent)]',
  'right-[4%] top-[9rem] z-20 h-32 w-[46%] rotate-[3deg] shadow-[0_24px_50px_-18px_color-mix(in_oklab,var(--color-brand-600)_50%,transparent)]',
] as const;

// The pictures size themselves for a small tile; in a sheet they fill it.
const FILL = 'block h-full w-full [&>*]:h-full! [&>*]:w-full!';

/** The fan of sheets, at most four. It fades in only where motion is welcome (and the host's theme animates). */
export function HeroSheets({ label, sheets }: { label: string; sheets: readonly HeroSheet[] }) {
  return (
    <div
      role="group"
      aria-label={label}
      data-hero-features=""
      className="absolute inset-0 motion-safe:animate-fade-in"
    >
      {sheets.slice(0, SHEET_PLACES.length).map((sheet, i) => (
        <span
          key={sheet.id}
          role="img"
          aria-label={sheet.label}
          data-hero-sheet={sheet.id}
          className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}
        >
          <span className={`${FILL} dark:hidden`}>{sheet.light}</span>
          <span className={`${FILL} hidden dark:block`}>{sheet.dark}</span>
          <span
            aria-hidden
            className="absolute left-1.5 top-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200"
          >
            {sheet.label}
          </span>
        </span>
      ))}
    </div>
  );
}

// What a manifest may draw: boxes, text and SVG shapes. Anything else is left out, with its children.
const DRAWING = new Set([
  'div',
  'span',
  'svg',
  'g',
  'defs',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'text',
  'tspan',
]);

function safeProps(props: Record<string, unknown> | null, key: number): Record<string, unknown> {
  const out: Record<string, unknown> = { key };
  if (!props) return out;
  for (const [name, value] of Object.entries(props)) {
    if (/^on/i.test(name) || name === 'dangerouslySetInnerHTML' || name === 'ref') continue;
    if (name === 'href' || name === 'xlinkHref' || name === 'src') continue;
    // A style is an object of plain values, never one reaching out for a picture.
    if (
      name === 'style' &&
      (typeof value !== 'object' || !value || /url\(/i.test(JSON.stringify(value)))
    )
      continue;
    out[name] = value;
  }
  return out;
}

/** A manifest picture's markup as React elements. */
export function renderHeroArtNode(node: HeroArtNode, key = 0): ReactNode {
  if (typeof node === 'string') return node;
  if (!Array.isArray(node)) return null;
  const [tag, props, ...children] = node;
  if (typeof tag !== 'string' || !DRAWING.has(tag)) return null;
  return createElement(
    tag,
    safeProps(props, key),
    ...children.map((child, i) => renderHeroArtNode(child, i)),
  );
}

/** An app's hero art from its manifest, for a host that carries none of the app's code. */
export function HeroArt({ art }: { art: HeroArtManifest }) {
  return (
    <HeroSheets
      label={art.label}
      sheets={art.sheets.map((s) => ({
        id: s.id,
        label: s.label,
        light: <Fragment>{renderHeroArtNode(s.light)}</Fragment>,
        dark: <Fragment>{renderHeroArtNode(s.dark)}</Fragment>,
      }))}
    />
  );
}
