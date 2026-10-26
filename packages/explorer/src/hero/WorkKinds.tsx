// What the app makes, on Home's hero (liveworkspace/docs/specs/004-index/one-explorer.md "What you can make, on Home's hero"): a
// tile per kind of work (WORK_KINDS), each its picture over its name, in its own app's brand colours whatever the
// host's, so every app's set looks alike and All shows each app's in that app's colour. A tile starts its kind
// through the app's New route with its template. Static SVG; nothing is fetched.

import { BRAND_APPS, type BrandStep } from '@liveworkspace/brand';
import type { App } from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import type { CSSProperties } from 'react';
import { siteOf } from '../words';
import { workTiles, type WorkTile } from './work-kinds';

/** Where a tile starts its kind: the app's New route with the template, or null for no link. */
export type TemplateHref = (app: App, template: string) => string | null;

export const WORK_KINDS_COPY = { heading: 'What you can make' } as const;

const HEADING_ID = 'explorer-home-work-kinds';

// The picture's frame, in SVG units: the paper sits in the box, on a wash of the app's palest tint.
const VIEW = { w: 160, h: 100 } as const;
const BOX = { x: 16, y: 12, w: 128, h: 76 } as const;

// The app's ramp as the tile's own variables; explorer.css `.lw-work-art` maps them onto `--color-brand-*` (and turns
// the picture for dark), so the pictures' `brand` classes draw in this app's colours on any host.
const STEPS: readonly BrandStep[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const rampVars = new Map<App, CSSProperties>();
function rampOf(app: App): CSSProperties {
  let vars = rampVars.get(app);
  if (!vars) {
    const ramp = BRAND_APPS[app].ramp;
    vars = Object.fromEntries(STEPS.map((s) => [`--wk-${s}`, ramp[s]])) as CSSProperties;
    rampVars.set(app, vars);
  }
  return vars;
}

/** The app's New route with the template: the host app's on this origin, another app's on that app's own site (as an
 *  editor opens another app's items there). */
export const defaultTemplateHref =
  (host: App): TemplateHref =>
  (app, template) =>
    `${app === host ? '' : siteOf(app).url}${APP_ITEMS[app].newPath}?template=${encodeURIComponent(template)}`;

const TILE =
  'flex h-full min-w-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-1 pb-2 sm:gap-2 sm:rounded-2xl sm:p-1.5 sm:pb-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-800/80';
const LINKED =
  'transition duration-micro hover:border-[color:var(--wk-400)] hover:shadow-[0_0_0_3px_color-mix(in_oklab,var(--wk-300)_30%,transparent),0_14px_28px_-16px_color-mix(in_oklab,var(--wk-600)_55%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wk-500)] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none';

function Tile({ tile, all, href }: { tile: WorkTile; all: boolean; href: string | null }) {
  const { app, kind, label } = tile;
  const name = all ? `New ${label} in ${siteOf(app).name}` : `New ${label}`;
  const body = (
    <>
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        aria-hidden="true"
        focusable="false"
        className="lw-work-art block h-auto w-full rounded-lg sm:rounded-xl"
      >
        <rect width={VIEW.w} height={VIEW.h} className="fill-brand-50" />
        {kind.draw(BOX)}
      </svg>
      {/* Two lines held on a phone, where a longer name wraps, so every app's tiles stand as tall. */}
      <span className="min-h-8 break-words px-0.5 text-xs font-semibold leading-4 text-slate-800 sm:min-h-0 sm:px-1 sm:text-[13px] sm:leading-[18px] dark:text-slate-100">
        {label}
      </span>
    </>
  );
  const data = { 'data-work-kind': kind.id, 'data-work-app': app };
  return href ? (
    <a
      href={href}
      aria-label={name}
      title={name}
      style={rampOf(app)}
      className={`${TILE} ${LINKED}`}
      {...data}
    >
      {body}
    </a>
  ) : (
    <div role="img" aria-label={label} style={rampOf(app)} className={TILE} {...data}>
      {body}
    </div>
  );
}

/** The hero's set: the app's kinds, or one per app under All. Two by two in the hero's right column from `lg`, four
 *  across under the search field below that, a phone included. */
export function WorkKinds({
  app,
  all,
  templateHref,
}: {
  app: App;
  all: boolean;
  templateHref?: TemplateHref;
}) {
  const hrefOf = templateHref ?? defaultTemplateHref(app);
  const tiles = workTiles(app, all);
  return (
    <section aria-labelledby={HEADING_ID} data-work-kinds={all ? 'all' : app}>
      <h2
        id={HEADING_ID}
        className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
      >
        {WORK_KINDS_COPY.heading}
      </h2>
      <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-2">
        {tiles.map((tile) => (
          <li key={`${tile.app}:${tile.kind.id}`} className="min-w-0">
            <Tile tile={tile} all={all} href={hrefOf(tile.app, tile.kind.template)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
