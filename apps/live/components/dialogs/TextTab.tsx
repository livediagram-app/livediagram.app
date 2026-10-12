'use client';

// The Tab Style dialog's Text panel (docs/specs/011-theme/canvas-and-theme-dialog.md "Text panel"): a preview of the
// sample diagram lettered in the tab's font at the size new text takes, the typefaces as specimen cards ("Aa" in each
// face, its name and style) paged nine to a carousel, the size of new text as four tiles showing that size, and Apply
// to All Elements.

import { FONTS, type Finish, type TextSize } from '@livediagram/document';
import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { ScaleIcon } from '@/components/palette/palette-icons';
import { TabStylePreview } from './TabStylePreview';

const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/** How many typeface cards one carousel page holds: a 3 x 3 grid. */
const FONTS_PER_PAGE = 9;

type FontOption = { id: string | null; label: string; kind: string; stack: string | undefined };

// "Editor default" first (no tab font: the editor's own face), then the catalogue.
const FONT_OPTIONS: readonly FontOption[] = [
  { id: null, label: 'Editor default', kind: 'System', stack: undefined },
  ...FONTS.map((f) => ({ id: f.id, label: f.label, kind: f.kind, stack: f.stack })),
];

// The four sizes new text can take, each tile drawing a letter at roughly that size.
const SIZES: readonly { size: TextSize; label: string; letterPx: number | null }[] = [
  { size: 'sm', label: 'Small', letterPx: 13 },
  { size: 'md', label: 'Medium', letterPx: 17 },
  { size: 'lg', label: 'Large', letterPx: 22 },
  { size: 'scale', label: 'Scale', letterPx: null },
];

export function TextTab({
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  finish,
  canvasBackground,
  themeId,
}: {
  // The tab font; null is the editor default.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // The tab's look, so the preview is the tab's own.
  finish: Finish;
  canvasBackground: string | undefined;
  themeId: string;
}) {
  const size = defaultTextSize ?? 'md';
  const fontLabel = FONT_OPTIONS.find((o) => o.id === font)?.label ?? 'Editor default';
  return (
    <div className="flex flex-col gap-4">
      <TabStylePreview
        finish={finish}
        canvasBackground={canvasBackground}
        themeId={themeId}
        font={font}
        textSize={size}
        label={`A sample diagram lettered in ${fontLabel}`}
      />

      <PagedCarousel
        items={FONT_OPTIONS}
        perPage={FONTS_PER_PAGE}
        label="Typefaces"
        heading={<h3 className={sectionLabel}>Typeface</h3>}
        gridClass="grid grid-cols-3 gap-2"
        initialIndex={FONT_OPTIONS.findIndex((o) => o.id === font)}
        renderItem={(o) => (
          <TypefaceCard
            key={o.id ?? 'default'}
            option={o}
            active={o.id === font}
            onPick={() => onSetFont(o.id)}
          />
        )}
      />

      <div className="flex flex-col gap-2">
        <h3 className={sectionLabel}>Size of New Text</h3>
        <div role="radiogroup" aria-label="Size of new text" className="grid grid-cols-4 gap-2">
          {SIZES.map((s) => (
            <SizeTile
              key={s.size}
              option={s}
              active={size === s.size}
              onPick={() => onSetDefaultTextSize(s.size)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TypefaceCard({
  option,
  active,
  onPick,
}: {
  option: FontOption;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={option.label}
      onClick={onPick}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ${
        active
          ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
          : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        className="text-2xl leading-tight text-slate-800 dark:text-slate-100"
        style={option.stack ? { fontFamily: option.stack } : undefined}
      >
        Aa
      </span>
      <span
        className="w-full truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100"
        style={option.stack ? { fontFamily: option.stack } : undefined}
      >
        {option.label}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.kind}</span>
    </button>
  );
}

function SizeTile({
  option,
  active,
  onPick,
}: {
  option: (typeof SIZES)[number];
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border transition ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        className="flex h-7 items-end font-semibold leading-none"
        style={option.letterPx ? { fontSize: option.letterPx } : undefined}
      >
        {option.letterPx ? 'A' : <ScaleIcon />}
      </span>
      <span className="text-[11px] font-medium">{option.label}</span>
    </button>
  );
}
