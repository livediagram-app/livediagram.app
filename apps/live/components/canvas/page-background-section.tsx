'use client';

// The page panel's Background section (docs/specs/007-editor/illustrate-pages.md "Backgrounds"), for
// every page kind: a category control (Theme while the tab's theme offers backgrounds, Solid,
// Gradient) over that category's swatches, Solid and Gradient each ending in a custom choice; the
// custom gradient's editor (From, To, Angle, Swap) while the page's fill is one; then the Pattern
// (not on a logo page). Each hover previews on the page itself (`onPreview`), and a press commits;
// leaving the section drops the preview.
import { useState, type ReactNode } from 'react';
import {
  PAGE_PATTERNS,
  pageKindOf,
  pageIsDark,
  type IllustratePage,
  type PageBackground,
  type PageFill,
  type PagePattern,
} from '@livediagram/document';
import { ACTIVE_SEGMENT, CheckIcon, SEGMENT_TRACK, Tooltip } from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import {
  backgroundCategoryOf,
  customGradientSeed,
  fillCss,
  gradientFill,
  isCustomGradient,
  PAGE_GRADIENT_PRESETS,
  PAGE_PATTERN_LABEL,
  PAGE_SOLID_PRESETS,
  pageSheetStyle,
  sameFill,
  type BackgroundCategory,
  type ThemeBackgroundPreset,
} from '@/lib/illustrate-page-paint';
import { PanelSection, tileClass } from './illustrate-page-panel-sections';
import {
  ColourWellButton,
  CustomGradientEditor,
  InlineColourPicker,
} from './page-background-custom';

// The custom choices' swatch until one is the page's fill.
const RAINBOW = 'conic-gradient(#f87171, #fbbf24, #4ade80, #22d3ee, #818cf8, #e879f9, #f87171)';

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

const CATEGORY_LABEL: Record<BackgroundCategory, string> = {
  theme: 'Theme',
  solid: 'Solid',
  gradient: 'Gradient',
};

// Theme, Solid, Gradient: the shared segmented control, its highlight sliding between them.
function CategoryControl({
  categories,
  value,
  onChange,
}: {
  categories: readonly BackgroundCategory[];
  value: BackgroundCategory;
  onChange: (c: BackgroundCategory) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Background kind"
      className={`relative mb-2 grid rounded-lg p-0.5 ${SEGMENT_TRACK}`}
      style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
    >
      <SegmentSlider
        count={categories.length}
        index={categories.indexOf(value)}
        className={ACTIVE_SEGMENT}
      />
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          onClick={() => onChange(c)}
          className={`relative z-10 rounded-md py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
            c === value
              ? 'text-white'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          {CATEGORY_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

export function BackgroundSection({
  page,
  themePresets,
  onBackground,
  onPreview,
}: {
  page: IllustratePage;
  // The tab theme's own backgrounds (themeBackgroundPresets), offered first.
  themePresets: readonly ThemeBackgroundPreset[];
  onBackground: (patch: Partial<PageBackground>) => void;
  onPreview: (patch: Partial<PageBackground> | null) => void;
}) {
  const fill = page.background?.fill;
  const pattern = page.background?.pattern;
  const categories: BackgroundCategory[] = themePresets.length
    ? ['theme', 'solid', 'gradient']
    : ['solid', 'gradient'];
  // Opens on the current fill's category; choosing another changes nothing on the page.
  const [chosen, setChosen] = useState<BackgroundCategory | null>(null);
  const opened = backgroundCategoryOf(fill, themePresets);
  const category = chosen && categories.includes(chosen) ? chosen : opened;
  const solidPicked = PAGE_SOLID_PRESETS.some((s) =>
    sameFill(fill, s.color ? { kind: 'solid', color: s.color } : undefined),
  );
  const themePicked = themePresets.some((t) => sameFill(fill, t.fill));
  const custom = fill?.kind === 'solid' && !solidPicked && !themePicked ? fill.color : null;
  // The custom gradient's editor shows for a gradient no preset names, or once Custom gradient is
  // pressed on a preset one (its colours are where the custom one starts; editing makes it custom).
  const [customOpen, setCustomOpen] = useState(false);
  // The custom solid colour's picker, open under the swatches.
  const [pickingSolid, setPickingSolid] = useState(false);
  const customGradient =
    fill?.kind === 'gradient' && (customOpen || isCustomGradient(fill, themePresets)) ? fill : null;
  const pick = (f: PageFill | undefined) => onBackground({ fill: f });
  const preview = (f: PageFill | undefined) => onPreview({ fill: f });
  return (
    <div
      onPointerLeave={() => onPreview(null)}
      // Focus leaving the section, not moving inside it (the colour picker's controls).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onPreview(null);
      }}
    >
      <PanelSection title="Background">
        <CategoryControl
          categories={categories}
          value={category}
          onChange={(c) => {
            setCustomOpen(false);
            setChosen(c);
          }}
        />
        {category === 'theme' ? (
          <div
            role="radiogroup"
            aria-label="Theme backgrounds"
            className="grid grid-cols-7 gap-1.5"
          >
            {themePresets.map((t) => {
              const on = sameFill(fill, t.fill);
              return (
                <Swatch
                  key={t.id}
                  label={t.label}
                  background={fillCss(t.fill)}
                  active={on}
                  onPick={() => pick(t.fill)}
                  onPreview={() => preview(t.fill)}
                >
                  {on ? <SwatchCheck fill={t.fill} /> : null}
                </Swatch>
              );
            })}
          </div>
        ) : category === 'solid' ? (
          <>
            <div
              role="radiogroup"
              aria-label="Background colour"
              className="grid grid-cols-7 gap-1.5"
            >
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
                    onPick={() => pick(presetFill)}
                    onPreview={() => preview(presetFill)}
                  >
                    {on ? <SwatchCheck fill={presetFill} /> : null}
                  </Swatch>
                );
              })}
              <Tooltip label={custom ? `Custom ${custom}` : 'Custom colour'}>
                <ColourWellButton
                  label="Custom background colour"
                  colour={custom ?? RAINBOW}
                  open={pickingSolid || !!custom}
                  className="h-7 w-7"
                  onToggle={() => {
                    if (pickingSolid) onPreview(null);
                    setPickingSolid((v) => !v);
                  }}
                />
              </Tooltip>
            </div>
            {pickingSolid ? (
              <InlineColourPicker
                start={custom ?? (fill?.kind === 'solid' ? fill.color : '#ffffff')}
                onPreview={(color) => preview({ kind: 'solid', color })}
                onUse={(color) => {
                  pick({ kind: 'solid', color });
                  setPickingSolid(false);
                }}
                onCancel={() => {
                  onPreview(null);
                  setPickingSolid(false);
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <div
              role="radiogroup"
              aria-label="Background gradient"
              className="grid grid-cols-7 gap-1.5"
            >
              {PAGE_GRADIENT_PRESETS.map((g) => {
                const gFill = gradientFill(g);
                const on = !customGradient && sameFill(fill, gFill);
                return (
                  <Swatch
                    key={g.id}
                    label={g.label}
                    background={fillCss(gFill)}
                    active={on}
                    onPick={() => {
                      setCustomOpen(false);
                      pick(gFill);
                    }}
                    onPreview={() => preview(gFill)}
                  >
                    {on ? <SwatchCheck fill={gFill} /> : null}
                  </Swatch>
                );
              })}
              <Swatch
                label="Custom gradient"
                background={customGradient ? fillCss(customGradient) : RAINBOW}
                active={!!customGradient}
                onPick={() => {
                  setCustomOpen(true);
                  pick(customGradientSeed(fill));
                }}
                onPreview={() => preview(customGradientSeed(fill))}
              >
                {customGradient ? <SwatchCheck fill={customGradient} /> : null}
              </Swatch>
            </div>
            {customGradient ? (
              <CustomGradientEditor
                fill={customGradient}
                onPreview={preview}
                onPreviewEnd={() => onPreview(null)}
                onCommit={pick}
              />
            ) : null}
          </>
        )}
      </PanelSection>
      {/* A logo page takes no pattern (docs/specs/007-editor/logo-pages.md "A logo page"). */}
      {pageKindOf(page) === 'logo' ? null : (
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
      )}
    </div>
  );
}
