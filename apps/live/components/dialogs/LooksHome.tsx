'use client';

// The Tab Style dialog's home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks", "Fine-tune"): the looks
// carousel (LooksCarousel), then one Fine-tune row per setting showing its current value, each opening that setting's
// panel in place. Looks only set the tab's existing settings (lib/tab-looks.ts); the panels are the existing
// controls.

import type { ReactNode } from 'react';
import {
  FONTS,
  type BackgroundPattern,
  type Finish,
  type TextSize,
  type TextSizePreset,
} from '@livediagram/document';
import { Glyph, lucideGlyph } from '@livediagram/ui';
import { lucideChevronRight } from '@livediagram/icons/lucide';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { patternLabel as labelOfPattern } from '@/components/palette/palette-patterns';
import { getTheme } from '@/lib/themes';
import { type LookSettings, type TabLook, type TabLookId } from '@/lib/tab-looks';
import { LooksCarousel } from './LooksCarousel';

/** The panels a Fine-tune row opens. */
export type LookPanel = 'theme' | 'finish' | 'font' | 'canvas';

const SIZE_LABELS: Record<TextSizePreset, string> = {
  scale: 'scaled',
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

// An exact size from the Text Size slider reads as its px.
const sizeLabel = (size: TextSize | undefined): string =>
  typeof size === 'number' ? `${size}px` : SIZE_LABELS[size ?? 'md'];

const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function LooksHome({
  settings,
  activeLook,
  onPickLook,
  themeId,
  finish,
  font,
  defaultTextSize,
  pattern,
  onOpenPanel,
}: {
  // The tab's four look settings (the Mashup card is selected while they are its mashup's).
  settings: LookSettings;
  // The look the tab's settings match, undefined when it has its own mix.
  activeLook: TabLookId | undefined;
  // A named look's id, or the Mashup card's random look whole.
  onPickLook: (look: TabLookId | TabLook) => void;
  // The tab's current settings, for the Fine-tune rows' summaries.
  themeId: string;
  finish: Finish;
  font: string | null;
  defaultTextSize: TextSize | undefined;
  pattern: BackgroundPattern;
  onOpenPanel: (panel: LookPanel) => void;
}) {
  const theme = getTheme(themeId);
  const fontLabel = FONTS.find((f) => f.id === font)?.label ?? 'Editor default';
  const patternLabel = labelOfPattern(pattern);
  return (
    <div className="flex flex-col gap-5">
      <LooksCarousel
        settings={settings}
        activeLook={activeLook}
        onPickLook={onPickLook}
        headingClass={sectionLabel}
      />

      <section
        aria-labelledby="fine-tune-heading"
        data-tour-id="tab-style-fine-tune"
        className="flex flex-col gap-2"
      >
        <h3 id="fine-tune-heading" className={sectionLabel}>
          Fine-tune
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FineTuneRow
            label="Colours"
            value={`${theme.label} theme`}
            icon={
              <span className="block w-8 overflow-hidden rounded">
                <ThemeSwatch theme={theme} heightClass="h-5" />
              </span>
            }
            onOpen={() => onOpenPanel('theme')}
          />
          <FineTuneRow
            label="Finish"
            value={FINISH_LABELS[finish]}
            icon={<FinishSwatch finish={finish} />}
            onOpen={() => onOpenPanel('finish')}
          />
          <FineTuneRow
            label="Text"
            value={`${fontLabel}, ${sizeLabel(defaultTextSize)}`}
            icon={<span className="text-[15px] font-semibold">Aa</span>}
            onOpen={() => onOpenPanel('font')}
          />
          <FineTuneRow
            label="Canvas"
            value={patternLabel}
            icon={<CanvasGlyph />}
            onOpen={() => onOpenPanel('canvas')}
          />
        </div>
      </section>
    </div>
  );
}

function FineTuneRow({
  label,
  value,
  icon,
  onOpen,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}: ${value}`}
      className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <span
        aria-hidden
        className="flex h-6 w-8 shrink-0 items-center justify-center text-slate-500 dark:text-slate-300"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </span>
        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{value}</span>
      </span>
      <ChevronIcon />
    </button>
  );
}

// The row's chevron and the Canvas row's glyph (a dotted tile), on the shared icon grid.
const ChevronIcon = lucideGlyph(lucideChevronRight, 16);

function CanvasGlyph() {
  return (
    <Glyph size={20} units={20}>
      <rect x="2" y="3" width="16" height="14" rx="3" />
      <circle cx="7" cy="8" r="0.6" fill="currentColor" />
      <circle cx="10" cy="8" r="0.6" fill="currentColor" />
      <circle cx="13" cy="8" r="0.6" fill="currentColor" />
      <circle cx="7" cy="12" r="0.6" fill="currentColor" />
      <circle cx="10" cy="12" r="0.6" fill="currentColor" />
      <circle cx="13" cy="12" r="0.6" fill="currentColor" />
    </Glyph>
  );
}
