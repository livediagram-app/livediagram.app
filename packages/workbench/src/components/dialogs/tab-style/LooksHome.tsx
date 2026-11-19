'use client';

// The Tab Style dialog's home (liveworkspace/docs/specs/011-workbench/tab-style.md; each product's
// 011-theme/canvas-and-theme-dialog.md "Looks", "Fine-tune"): the looks carousel (LooksCarousel), then one Fine-tune
// row per panel the surface shows, each with its current value, opening that panel in place.

import type { ReactNode } from 'react';
import type { Finish } from '@liveworkspace/element-model/finish';
import type { TextSize, TextSizePreset } from '@liveworkspace/model-core/basics';
import { Glyph, lucideGlyph } from '@liveworkspace/ui';
import { lucideChevronRight, lucideSlidersHorizontal } from '@liveworkspace/icons/lucide';
import type { TabLookSettings } from '../../../lib/tab-looks';
import { LooksCarousel } from './LooksCarousel';
import { tabStyleFontLabel } from './tab-style-fonts';
import type {
  TabStyleLook,
  TabStylePanel,
  TabStyleProfile,
  TabStyleSurface,
} from './tab-style-profile';

const SIZE_LABELS: Record<TextSizePreset, string> = {
  scale: 'scaled',
  sm: 'small',
  md: 'medium',
  lg: 'large',
};

// An exact size from the Text Size slider reads as its px.
const sizeLabel = (size: TextSize | undefined): string =>
  typeof size === 'number' ? `${size}px` : SIZE_LABELS[size ?? 'md'];

/** The home's section headings. */
export const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function LooksHome<Look extends TabStyleLook, Pattern extends string>({
  profile,
  surface,
  settings,
  onPickLook,
  themeId,
  finish,
  font,
  defaultTextSize,
  pattern,
  onOpenPanel,
  onOpenLink,
}: {
  profile: TabStyleProfile<Look, Pattern>;
  surface: TabStyleSurface<Look, Pattern>;
  // The tab's four look settings (a card is selected while they are its look's).
  settings: TabLookSettings;
  // A named look's id, or the Mashup card's random look whole.
  onPickLook: (look: string | Look) => void;
  // The tab's current settings, for the Fine-tune rows' summaries.
  themeId: string;
  finish: Finish;
  font: string | null;
  defaultTextSize: TextSize | undefined;
  pattern: Pattern;
  onOpenPanel: (panel: TabStylePanel) => void;
  // A link row's press: the dialog closes, then the product's setting opens.
  onOpenLink: (open: () => void) => void;
}) {
  const { label: themeLabel, swatch } = profile.themeSummary(themeId);
  const { FinishSwatch } = profile;
  const titles = surface.copy.panelTitles;
  const fontLabel = tabStyleFontLabel(font);
  const rows: Record<TabStylePanel, { value: string; icon: ReactNode }> = {
    theme: {
      value: `${themeLabel} theme`,
      icon: <span className="block w-8 overflow-hidden rounded">{swatch}</span>,
    },
    finish: { value: profile.finishLabels[finish], icon: <FinishSwatch finish={finish} /> },
    font: {
      value: surface.hiddenControls.includes('defaultTextSize')
        ? fontLabel
        : `${fontLabel}, ${sizeLabel(defaultTextSize)}`,
      icon: <span className="text-[15px] font-semibold">Aa</span>,
    },
    canvas: { value: profile.patternLabel(pattern), icon: <CanvasGlyph /> },
  };
  const activeLook = profile.looks.activeId(settings);
  return (
    <div className="flex flex-col gap-5">
      <LooksCarousel
        profile={profile}
        lookFilter={surface.lookFilter}
        settings={settings}
        activeLook={activeLook}
        onPickLook={onPickLook}
        headingClass={SECTION_LABEL}
      />

      <section
        aria-labelledby="fine-tune-heading"
        data-tour-id="tab-style-fine-tune"
        className="flex flex-col gap-2"
      >
        <h3 id="fine-tune-heading" className={SECTION_LABEL}>
          Fine-tune
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {surface.panels.map((panel) => (
            <FineTuneRow
              key={panel}
              label={titles[panel]}
              value={rows[panel].value}
              icon={rows[panel].icon}
              onOpen={() => onOpenPanel(panel)}
            />
          ))}
          {surface.links?.map((link) => (
            <FineTuneRow
              key={link.id}
              linkId={link.id}
              label={link.label}
              value={link.value}
              icon={<SettingsGlyph />}
              onOpen={() => onOpenLink(link.onOpen)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function FineTuneRow({
  linkId,
  label,
  value,
  icon,
  onOpen,
}: {
  // A link row's id (a setting outside the dialog), unset on a panel's row.
  linkId?: string;
  label: string;
  value: string;
  icon: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-tab-style-link={linkId}
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
// A link row's glyph: the settings it opens live elsewhere.
const SettingsGlyph = lucideGlyph(lucideSlidersHorizontal, 18);

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
