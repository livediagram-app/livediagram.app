'use client';

// The Tab Style dialog's Text panel (each product's 011-theme/canvas-and-theme-dialog.md "Text panel"): the product's
// preview lettered in the tab's font at the size new text takes, the typefaces as specimen cards ("Aa" in each face,
// its name and style) paged six to a carousel, and the size of new text on the product's Text Size control (which the
// preview follows as it moves). A surface that hides the default text size leaves the size out.

import { useMemo, useState, type ReactNode } from 'react';
import type { TextSize } from '@liveworkspace/model-core/basics';
import { PagedCarousel } from '../../primitives/PagedCarousel';
import { SECTION_LABEL } from './LooksHome';
import { tabStyleFontLabel, tabStyleFontOptions, type TabStyleFontOption } from './tab-style-fonts';
import type { TabStyleLook, TabStyleProfile, TabStylePreviewProps } from './tab-style-profile';

/** How many typeface cards one carousel page holds: three to a row, two rows. */
const FONTS_PER_PAGE = 6;

export function TextPanel<Look extends TabStyleLook, Pattern extends string>({
  profile,
  font,
  onSetFont,
  defaultTextSize,
  onSetDefaultTextSize,
  showSize,
  renderPreview,
}: {
  profile: Pick<TabStyleProfile<Look, Pattern>, 'fonts' | 'TextSizeControl'>;
  // The tab font; null is the editor default.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Whether the Size of New Text control shows on this surface.
  showSize: boolean;
  renderPreview: (props: Pick<TabStylePreviewProps, 'fontLabel' | 'textSize'>) => ReactNode;
}) {
  const { TextSizeControl } = profile;
  const options = useMemo(() => tabStyleFontOptions(profile.fonts), [profile.fonts]);
  const size = defaultTextSize ?? 'md';
  // The slider's size while it is dragged or Scale is hovered, so the preview shows it before it is set.
  const [previewSize, setPreviewSize] = useState<TextSize | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {renderPreview({ fontLabel: tabStyleFontLabel(font), textSize: previewSize ?? size })}

      <PagedCarousel
        items={options}
        perPage={FONTS_PER_PAGE}
        label="Typefaces"
        heading={<h3 className={SECTION_LABEL}>Typeface</h3>}
        gridClass="grid grid-cols-3 gap-2"
        initialIndex={options.findIndex((o) => o.id === font)}
        renderItem={(o) => (
          <TypefaceCard
            key={o.id ?? 'default'}
            option={o}
            active={o.id === font}
            onPick={() => onSetFont(o.id)}
          />
        )}
      />

      {showSize ? (
        <div className="flex flex-col gap-2">
          <h3 className={SECTION_LABEL}>Size of New Text</h3>
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
      ) : null}
    </div>
  );
}

function TypefaceCard({
  option,
  active,
  onPick,
}: {
  option: TabStyleFontOption;
  active: boolean;
  onPick: () => void;
}) {
  const face = option.stack ? { fontFamily: option.stack } : undefined;
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
      <span aria-hidden className="text-2xl leading-tight text-slate-800 dark:text-slate-100" style={face}>
        Aa
      </span>
      <span
        className="w-full truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100"
        style={face}
      >
        {option.label}
      </span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.kind}</span>
    </button>
  );
}
