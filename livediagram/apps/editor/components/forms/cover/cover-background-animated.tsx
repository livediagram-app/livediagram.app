'use client';

// The Background section's Animated category (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover):
// a carousel of motions, six to a page (two rows of
// three), each tile playing in the tab theme's colours; then the theme colourings the chosen
// motion comes in, and its speed. A hover previews on the cover, a press sets it, as the other
// categories do; the speed previews as it is dragged and is set once, on letting go.
import { useState } from 'react';
import {
  PAGE_MOTION_SPEED_MAX,
  PAGE_MOTION_SPEED_MIN,
  type PageColourFill,
  type PageMotion,
} from '@/lib/form-cover/colour-background';
import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { RANGE_SLIDER } from '@/components/primitives/surface-classes';
import { CheckIcon, Tooltip } from '@livediagram/ui';
import { fillCss, type ThemeBackgroundPreset } from '@/lib/form-cover/cover-paint';
import {
  colouringOf,
  motionColouring,
  motionFill,
  PAGE_MOTION_CATALOGUE,
  PAGE_MOTION_COLOURINGS,
  type PageMotionColouringId,
} from '@/lib/form-cover/cover-motion';
import { track } from '@/lib/telemetry';
import { CustomGradientEditor, RAINBOW } from './cover-background-custom';
import { CoverMotionLayer } from './CoverMotionLayer';

// A tile's preview, 16:9, in its own px.
const TILE_W = 84;
const TILE_H = 47;

/** The theme's accent and second colour, read back from its gradient presets (Theme bright runs
 *  from one to the other): all a colouring needs. */
function themeOfPresets(presets: readonly ThemeBackgroundPreset[]) {
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

const MOTION_NOTE = 'Moves in the builder and on the form’s page; still with Reduce Motion on.';

export function AnimatedBackgroundChoices({
  fill,
  themePresets,
  onPick,
  onPreview,
}: {
  fill: PageColourFill | undefined;
  themePresets: readonly ThemeBackgroundPreset[];
  onPick: (fill: PageColourFill) => void;
  onPreview: (fill: PageColourFill) => void;
}) {
  const theme = themeOfPresets(themePresets);
  const motion = fill?.kind === 'gradient' ? fill.motion : undefined;
  // The colouring the motion is in; once picked, it carries to the next motion chosen.
  const [chosen, setChosen] = useState<PageMotionColouringId | null>(null);
  // Colours of the author's own (Custom): kept through a motion change, and through a theme change
  // (they are not the theme's).
  const [customOpen, setCustomOpen] = useState(false);
  const custom =
    fill?.kind === 'gradient' && !!fill.motion && colouringOf(theme, fill) === undefined
      ? fill
      : null;
  const current = custom ? undefined : (colouringOf(theme, fill) ?? chosen ?? undefined);
  // The speed carries to whatever motion or colouring is picked next.
  const speed = fill?.kind === 'gradient' ? (fill.speed ?? 1) : 1;
  const [dragSpeed, setDragSpeed] = useState<number | null>(null);
  const withSpeed = (f: PageColourFill, s: number): PageColourFill =>
    f.kind === 'gradient' && s !== 1 ? { ...f, speed: s } : f;
  const fillFor = (id: PageMotion, colouring?: PageMotionColouringId): PageColourFill =>
    !colouring && custom
      ? { ...custom, motion: id }
      : withSpeed(
          motionFill(
            theme,
            id,
            colouring ?? current ?? PAGE_MOTION_CATALOGUE.find((m) => m.id === id)!.colouring,
          ),
          speed,
        );
  const shownSpeed = dragSpeed ?? speed;
  const commitSpeed = () => {
    if (dragSpeed === null || fill?.kind !== 'gradient' || !fill.motion) return;
    const { speed: _old, ...rest } = fill;
    onPick(withSpeed(rest, dragSpeed));
    track('Tab', 'Changed', 'PageBackgroundAnimatedSpeed');
    setDragSpeed(null);
  };
  return (
    <div data-cover-background-animated="">
      <PagedCarousel
        items={PAGE_MOTION_CATALOGUE}
        perPage={6}
        label="Animated backgrounds"
        heading={
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Motion
          </span>
        }
        gridClass="grid grid-cols-3 gap-1.5"
        initialIndex={PAGE_MOTION_CATALOGUE.findIndex((m) => m.id === motion)}
        renderItem={(m) => {
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
                    <CoverMotionLayer motion={m.id} fill={f} width={TILE_W} height={TILE_H} />
                  ) : null}
                </span>
                {m.label}
              </button>
            </Tooltip>
          );
        }}
      />
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
                  setCustomOpen(false);
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
        {motion ? (
          <Tooltip label="Custom Colours">
            <button
              type="button"
              role="radio"
              aria-checked={!!custom}
              aria-label="Custom Colours"
              onClick={() => setCustomOpen(true)}
              className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
                custom ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''
              }`}
              style={{ background: custom ? fillCss(custom) : RAINBOW }}
            >
              {custom ? (
                <CheckIcon className="h-3.5 w-3.5 text-white mix-blend-difference" />
              ) : null}
            </button>
          </Tooltip>
        ) : null}
      </div>
      {/* The two colours of the author's own, as the Gradient category's custom editor sets them;
          the motion and its speed ride along. */}
      {(customOpen || custom) && fill?.kind === 'gradient' && motion ? (
        <div className="mt-2">
          <CustomGradientEditor
            fill={fill}
            onPreview={onPreview}
            onPreviewEnd={() => onPreview(fill)}
            onCommit={(f) => {
              track('Tab', 'Changed', 'PageBackgroundAnimated');
              onPick(f);
            }}
          />
        </div>
      ) : null}
      {motion ? (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Speed
            </p>
            <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-300">
              {Math.round(shownSpeed * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Animation speed"
            min={PAGE_MOTION_SPEED_MIN}
            max={PAGE_MOTION_SPEED_MAX}
            step={0.25}
            value={shownSpeed}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setDragSpeed(v);
              if (fill?.kind === 'gradient') {
                const { speed: _old, ...rest } = fill;
                onPreview(withSpeed(rest, v));
              }
            }}
            onPointerUp={commitSpeed}
            onKeyUp={commitSpeed}
            onBlur={commitSpeed}
            className={RANGE_SLIDER}
          />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {MOTION_NOTE}
      </p>
    </div>
  );
}
