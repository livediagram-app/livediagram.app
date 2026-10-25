'use client';

// The Tab Style dialog's Text panel (docs/specs/011-theme/canvas-and-theme-dialog.md "Text panel"): a preview of the
// sample diagram lettered in the tab's font at the size new text takes, the typefaces as specimen cards ("Aa" in each
// face, its name and style) paged nine to a carousel, the size of new text on the one Text Size control (Scale, or a
// px from the slider, which the preview follows as it moves), and Apply to All Elements.

import { useState } from 'react';
import { FONTS, type Finish, type TextSize } from '@liveplanner/project';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import { TextSizeControl } from '@/components/palette/TextSizeControl';
import { TabStylePreview } from './TabStylePreview';

const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/** How many typeface cards one carousel page holds: three to a row, two rows. */
const FONTS_PER_PAGE = 6;

type FontOption = { id: string | null; label: string; kind: string; stack: string | undefined };

// "Editor default" first (no tab font: the editor's own face), then the catalogue.
const FONT_OPTIONS: readonly FontOption[] = [
  { id: null, label: 'Editor default', kind: 'System', stack: undefined },
  ...FONTS.map((f) => ({ id: f.id, label: f.label, kind: f.kind, stack: f.stack })),
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
  // The slider's size while it is dragged or Scale is hovered, so the preview shows it before it is set.
  const [previewSize, setPreviewSize] = useState<TextSize | null>(null);
  const fontLabel = FONT_OPTIONS.find((o) => o.id === font)?.label ?? 'Editor default';
  return (
    <div className="flex flex-col gap-4">
      <TabStylePreview
        finish={finish}
        canvasBackground={canvasBackground}
        themeId={themeId}
        font={font}
        textSize={previewSize ?? size}
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
        <div className="-mx-3">
          <TextSizeControl
            current={size}
            onSet={(next) => {
              setPreviewSize(null);
              onSetDefaultTextSize(next);
            }}
            onPreview={setPreviewSize}
            onPreviewEnd={() => setPreviewSize(null)}
          />
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
