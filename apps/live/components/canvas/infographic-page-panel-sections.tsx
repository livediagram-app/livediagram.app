'use client';

// The page panel's sections (docs/specs/007-editor/infographic-pages.md "Sizes", "Backgrounds"):
// size tiles, the orientation switch and the background swatches. Each hover previews on the page
// itself (`onPreview`), and a press commits; leaving the section drops the preview.
import { useEffect, useRef, type ReactNode } from 'react';
import {
  PAGE_PATTERNS,
  PAGE_SIZE_IDS,
  PAGE_SIZES,
  pageHasOrientation,
  pageIsDark,
  type InfographicPage,
  type PageBackground,
  type PageFill,
  type PageOrientation,
  type PagePattern,
  type PageSizeId,
} from '@livediagram/document';
import { ACTIVE_SEGMENT, CheckIcon, Glyph, SEGMENT_TRACK, Tooltip } from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import {
  fillCss,
  gradientFill,
  PAGE_GRADIENT_PRESETS,
  PAGE_PATTERN_LABEL,
  PAGE_SOLID_PRESETS,
  pageSheetStyle,
  sameFill,
  type ThemeBackgroundPreset,
} from '@/lib/infographic-page-paint';
import { hexish } from '@/components/palette/palette-controls';

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

// Short tile names: the full name is the tile's tooltip and the page label.
const SIZE_TILE: Record<PageSizeId, { label: string; hint: string }> = {
  a4: { label: 'A4', hint: 'A4 paper, for print' },
  letter: { label: 'Letter', hint: 'US Letter paper, for print in North America' },
  a3: { label: 'A3', hint: 'A3 paper, for posters' },
  square: { label: 'Square', hint: 'Square post (1:1)' },
  social: { label: 'Post', hint: 'Portrait post (4:5) for Instagram and LinkedIn' },
  wide: { label: 'Story', hint: 'Story (9:16), or a Slide (16:9) turned landscape' },
};

// A size drawn to scale in a 28 px box, in the page's current orientation.
function SizeGlyph({ size, orientation }: { size: PageSizeId; orientation: PageOrientation }) {
  const { short, long } = PAGE_SIZES[size];
  const scale = 24 / long;
  const [w, h] =
    orientation === 'portrait' ? [short * scale, long * scale] : [long * scale, short * scale];
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect
        x={14 - w / 2}
        y={14 - h / 2}
        width={w}
        height={h}
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

const tileClass = (active: boolean) =>
  `flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
    active
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function SizeSection({
  page,
  onSize,
}: {
  page: InfographicPage;
  onSize: (size: PageSizeId) => void;
}) {
  const current = page.size ?? 'a4';
  return (
    <PanelSection title="Size">
      <div role="radiogroup" aria-label="Page size" className="grid grid-cols-6 gap-1">
        {PAGE_SIZE_IDS.map((id) => (
          <Tooltip key={id} label={SIZE_TILE[id].hint}>
            <button
              type="button"
              role="radio"
              aria-checked={current === id}
              aria-label={PAGE_SIZES[id][page.orientation]}
              onClick={() => onSize(id)}
              className={tileClass(current === id)}
            >
              <SizeGlyph size={id} orientation={page.orientation} />
              {SIZE_TILE[id].label}
            </button>
          </Tooltip>
        ))}
      </div>
    </PanelSection>
  );
}

export function OrientationSection({
  page,
  onOrientation,
}: {
  page: InfographicPage;
  onOrientation: (o: PageOrientation) => void;
}) {
  if (!pageHasOrientation(page)) return null;
  return (
    <PanelSection title="Orientation">
      <div
        role="radiogroup"
        aria-label="Orientation"
        className={`relative grid grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
      >
        <SegmentSlider
          count={2}
          index={page.orientation === 'portrait' ? 0 : 1}
          className={ACTIVE_SEGMENT}
        />
        {(['portrait', 'landscape'] as const).map((o) => {
          const on = page.orientation === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onOrientation(o)}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
                on
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Glyph size={14} units={16}>
                <rect
                  x={o === 'portrait' ? 4 : 1.5}
                  y={o === 'portrait' ? 1.5 : 4}
                  width={o === 'portrait' ? 8 : 13}
                  height={o === 'portrait' ? 13 : 8}
                  rx={1.2}
                />
              </Glyph>
              {o === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

// One round swatch. The paper swatch is drawn as the paper (white, or slate in dark chrome).
function Swatch({
  label,
  background,
  active,
  onPick,
  onPreview,
  children,
}: {
  label: string;
  background: string | null;
  active: boolean;
  onPick: () => void;
  onPreview: () => void;
  children?: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={label}
        onClick={onPick}
        onPointerEnter={onPreview}
        onFocus={onPreview}
        className={`relative flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-inset ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
          background ? '' : 'bg-white dark:bg-slate-900'
        } ${active ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''}`}
        style={background ? { background } : undefined}
      >
        <span className="text-optical-centre">{children}</span>
      </button>
    </Tooltip>
  );
}

function SwatchCheck({ fill }: { fill: PageFill | undefined }) {
  const dark = pageIsDark({ background: { fill } });
  return <CheckIcon className={`h-3.5 w-3.5 ${dark ? 'text-white' : 'text-slate-800'}`} />;
}

const PATTERN_PREVIEW: Record<PagePattern | 'none', PageBackground> = {
  none: {},
  dots: { pattern: 'dots' },
  grid: { pattern: 'grid' },
  lines: { pattern: 'lines' },
};

export function BackgroundSection({
  page,
  themePresets,
  onBackground,
  onPreview,
}: {
  page: InfographicPage;
  // The tab theme's own backgrounds (themeBackgroundPresets), offered first.
  themePresets: readonly ThemeBackgroundPreset[];
  onBackground: (patch: Partial<PageBackground>) => void;
  onPreview: (patch: Partial<PageBackground> | null) => void;
}) {
  const fill = page.background?.fill;
  const pattern = page.background?.pattern;
  const solidPicked = PAGE_SOLID_PRESETS.some((s) =>
    sameFill(fill, s.color ? { kind: 'solid', color: s.color } : undefined),
  );
  const gradientPicked = PAGE_GRADIENT_PRESETS.some((g) => sameFill(fill, gradientFill(g)));
  const themePicked = themePresets.some((t) => sameFill(fill, t.fill));
  const custom = fill?.kind === 'solid' && !solidPicked && !themePicked ? fill.color : null;
  return (
    <div onPointerLeave={() => onPreview(null)} onBlur={() => onPreview(null)}>
      <PanelSection title="Background">
        {themePresets.length ? (
          <div
            role="radiogroup"
            aria-label="Theme backgrounds"
            className="mb-2 grid grid-cols-7 gap-1.5 border-b border-slate-100 pb-2 dark:border-slate-800"
          >
            {themePresets.map((t) => {
              const on = sameFill(fill, t.fill);
              return (
                <Swatch
                  key={t.id}
                  label={t.label}
                  background={fillCss(t.fill)}
                  active={on}
                  onPick={() => onBackground({ fill: t.fill })}
                  onPreview={() => onPreview({ fill: t.fill })}
                >
                  {on ? <SwatchCheck fill={t.fill} /> : null}
                </Swatch>
              );
            })}
          </div>
        ) : null}
        <div role="radiogroup" aria-label="Background colour" className="grid grid-cols-7 gap-1.5">
          {PAGE_SOLID_PRESETS.map((s) => {
            const presetFill: PageFill | undefined = s.color
              ? { kind: 'solid', color: s.color }
              : undefined;
            const on = sameFill(fill, presetFill);
            return (
              <Swatch
                key={s.id}
                label={s.label}
                background={s.color}
                active={on}
                onPick={() => onBackground({ fill: presetFill })}
                onPreview={() => onPreview({ fill: presetFill })}
              >
                {on ? <SwatchCheck fill={presetFill} /> : null}
              </Swatch>
            );
          })}
          <Tooltip label={custom ? `Custom ${custom}` : 'Custom colour'}>
            <label
              className={`relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full ring-1 ring-inset ring-slate-900/10 transition hover:scale-110 motion-reduce:hover:scale-100 dark:ring-white/15 ${
                custom ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''
              }`}
              style={{
                background:
                  custom ??
                  'conic-gradient(#f87171, #fbbf24, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)',
              }}
            >
              <CustomColourInput
                // A new value is a new input: its native change listener attaches to that one.
                key={hexish(custom ?? '#ffffff')}
                value={hexish(custom ?? '#ffffff')}
                onPreview={(color) => onPreview({ fill: { kind: 'solid', color } })}
                onCommit={(color) => onBackground({ fill: { kind: 'solid', color } })}
              />
            </label>
          </Tooltip>
        </div>
        <div
          role="radiogroup"
          aria-label="Background gradient"
          className="mt-2 grid grid-cols-7 gap-1.5"
        >
          {PAGE_GRADIENT_PRESETS.map((g) => {
            const gFill = gradientFill(g);
            const on = gradientPicked && sameFill(fill, gFill);
            return (
              <Swatch
                key={g.id}
                label={g.label}
                background={fillCss(gFill)}
                active={on}
                onPick={() => onBackground({ fill: gFill })}
                onPreview={() => onPreview({ fill: gFill })}
              >
                {on ? <SwatchCheck fill={gFill} /> : null}
              </Swatch>
            );
          })}
        </div>
      </PanelSection>
      <PanelSection title="Pattern">
        <div role="radiogroup" aria-label="Pattern" className="grid grid-cols-4 gap-1">
          {(['none', ...PAGE_PATTERNS] as const).map((p) => {
            const on = (pattern ?? 'none') === p;
            const value = p === 'none' ? undefined : p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onBackground({ pattern: value })}
                onPointerEnter={() => onPreview({ pattern: value })}
                onFocus={() => onPreview({ pattern: value })}
                className={tileClass(on)}
              >
                <span
                  aria-hidden
                  className="h-6 w-9 rounded-sm bg-white text-slate-900/25 ring-1 ring-inset ring-slate-900/10 dark:bg-slate-900 dark:text-white/25 dark:ring-white/15"
                  style={{
                    ...pageSheetStyle(PATTERN_PREVIEW[p]),
                    backgroundSize: p === 'lines' ? '100% 6px' : '6px 6px',
                  }}
                />
                {PAGE_PATTERN_LABEL[p]}
              </button>
            );
          })}
        </div>
      </PanelSection>
    </div>
  );
}

// The system colour picker: previews as the colour is dragged (`input`), commits once when the
// picker settles (the native `change`, which React's onChange does not wait for), so a drag is one
// edit, not one per tick.
function CustomColourInput({
  value,
  onPreview,
  onCommit,
}: {
  value: string;
  onPreview: (color: string) => void;
  onCommit: (color: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onChange = () => commit.current(el.value);
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <input
      ref={input}
      type="color"
      aria-label="Custom background colour"
      defaultValue={value}
      onInput={(e) => onPreview(e.currentTarget.value)}
      className="absolute h-0 w-0 opacity-0"
    />
  );
}
