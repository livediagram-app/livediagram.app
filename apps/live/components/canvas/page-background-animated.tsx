'use client';

// The Background section's Animated category, on a slide page (docs/specs/007-editor/
// illustrate-pages.md "Animated backgrounds"): a tile per motion, each playing in the tab theme's
// colours, then the theme colourings the chosen motion comes in. A hover previews on the slide,
// a press sets it, as the other categories do.
import { useState } from 'react';
import { type PageFill, type PageMotion } from '@livediagram/document';
import { CheckIcon, Tooltip } from '@livediagram/ui';
import { fillCss, type ThemeBackgroundPreset } from '@/lib/illustrate-page-paint';
import {
  colouringOf,
  motionColouring,
  motionFill,
  PAGE_MOTION_CATALOGUE,
  PAGE_MOTION_COLOURINGS,
  type PageMotionColouringId,
} from '@/lib/page-motion';
import { track } from '@/lib/telemetry';
import { PageMotionLayer } from './PageMotionLayer';

// A tile's preview, 16:9 like the slide it stands for, in its own px.
const TILE_W = 84;
const TILE_H = 47;

/** The theme's accent and second colour, read back from its gradient presets (Theme bright runs
 *  from one to the other): all a colouring needs. */
export function themeOfPresets(presets: readonly ThemeBackgroundPreset[]) {
  const bright = presets.find((p) => p.id === 'theme-bright')?.fill;
  return bright?.kind === 'gradient'
    ? {
        elementStroke: bright.from,
        palette: [
          { fill: '', stroke: bright.from, text: '' },
          { fill: '', stroke: bright.to, text: '' },
        ],
      }
    : {};
}

export function AnimatedBackgroundChoices({
  fill,
  themePresets,
  onPick,
  onPreview,
}: {
  fill: PageFill | undefined;
  themePresets: readonly ThemeBackgroundPreset[];
  onPick: (fill: PageFill) => void;
  onPreview: (fill: PageFill) => void;
}) {
  const theme = themeOfPresets(themePresets);
  const motion = fill?.kind === 'gradient' ? fill.motion : undefined;
  // The colouring the page's motion is in; once picked, it carries to the next motion chosen.
  const [chosen, setChosen] = useState<PageMotionColouringId | null>(null);
  const current = colouringOf(theme, fill) ?? chosen ?? undefined;
  const fillFor = (id: PageMotion, colouring?: PageMotionColouringId) =>
    motionFill(
      theme,
      id,
      colouring ?? current ?? PAGE_MOTION_CATALOGUE.find((m) => m.id === id)!.colouring,
    );
  return (
    <div data-page-background-animated="">
      <div role="radiogroup" aria-label="Animated background" className="grid grid-cols-3 gap-1.5">
        {PAGE_MOTION_CATALOGUE.map((m) => {
          const f = fillFor(m.id);
          const on = motion === m.id;
          return (
            <Tooltip key={m.id} label={`${m.label}: ${m.description}`}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={m.label}
                onClick={() => {
                  track('Tab', 'Changed', 'PageBackgroundAnimated');
                  onPick(f);
                }}
                onPointerEnter={() => onPreview(f)}
                onFocus={() => onPreview(f)}
                className={`flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
                  on ? 'bg-brand-50 ring-2 ring-inset ring-brand-500 dark:bg-brand-500/15' : ''
                }`}
              >
                <span
                  aria-hidden
                  className="relative block overflow-hidden rounded ring-1 ring-inset ring-slate-900/10 dark:ring-white/15"
                  style={{ width: TILE_W, height: TILE_H, background: fillCss(f) }}
                >
                  {f.kind === 'gradient' ? (
                    <PageMotionLayer motion={m.id} fill={f} width={TILE_W} height={TILE_H} />
                  ) : null}
                </span>
                {m.label}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <p
        aria-hidden
        className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        Colours
      </p>
      <div role="radiogroup" aria-label="Animated background colours" className="flex gap-1.5">
        {PAGE_MOTION_COLOURINGS.map((c) => {
          const { from, to } = motionColouring(theme, c.id);
          const on = current === c.id;
          const target = motion ? fillFor(motion, c.id) : null;
          return (
            <Tooltip key={c.id} label={c.label}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={c.label}
                onClick={() => {
                  setChosen(c.id);
                  if (target) onPick(target);
                }}
                onPointerEnter={() => target && onPreview(target)}
                onFocus={() => target && onPreview(target)}
                className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
                  on ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''
                }`}
                style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
              >
                {on ? <CheckIcon className="h-3.5 w-3.5 text-white mix-blend-difference" /> : null}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Moves on screen and while presenting; still in exports and with Reduce Motion on.
      </p>
    </div>
  );
}
