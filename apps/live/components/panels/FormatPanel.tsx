'use client';

// The Format Panel (spec/117): what the painter copies, and whether the brush
// stays loaded after a paint. The fifth mode panel, on the same terms as the
// others.
//
// The top of it is the BRUSH: what is currently loaded, drawn from the parts
// that are actually enabled. A painter whose contents you can't see is one you
// press hopefully — and with the toggles in play, "why didn't that copy the
// fill?" is a question the panel should answer before it is asked.

import { useState } from 'react';
import {
  formatCopiesSummary,
  formatPaintsAnything,
  FORMAT_GROUPS,
  FORMAT_MODES,
  type FormatConfig,
  type FormatGroup,
  type FormatMode,
} from '@/lib/format-config';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';

type Row = 'copies' | 'mode';

// What the brush holds. The swatch is drawn ONLY from enabled groups, so
// turning Fill off visibly empties the fill out of the preview — the same
// information the next paint will act on.
function BrushPreview({
  config,
  source,
}: {
  config: FormatConfig;
  source: { name: string; fill?: string; stroke?: string; textColor?: string } | null;
}) {
  const on = config.copies;
  return (
    <div className="mb-1 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/60">
      <span
        aria-hidden
        className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
        style={{
          background: on.fill ? (source?.fill ?? '#ffffff') : '#ffffff',
          border: `2px ${on.border ? 'solid' : 'dashed'} ${
            on.border ? (source?.stroke ?? '#cbd5e1') : '#e2e8f0'
          }`,
          color: on.text ? (source?.textColor ?? '#0f172a') : '#cbd5e1',
          opacity: source ? 1 : 0.5,
        }}
      >
        Aa
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {source ? source.name : 'Nothing loaded'}
        </span>
        <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
          {source ? `Copies: ${formatCopiesSummary(config)}` : 'Pick something to copy from'}
        </span>
      </span>
    </div>
  );
}

export function FormatPanel({
  config,
  onToggleGroup,
  onSetMode,
  source,
  position,
  onMoveTo,
  onReset,
  dock,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
  stackBelowY,
}: {
  config: FormatConfig;
  onToggleGroup: (group: FormatGroup) => void;
  onSetMode: (mode: FormatMode) => void;
  // The loaded element, described for the preview. Null until one is picked.
  source: { name: string; fill?: string; stroke?: string; textColor?: string } | null;
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  dock?: MovablePanelDockProps;
  mobileOpenOverride?: boolean;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
  onMobileClose?: () => void;
  stackBelowY?: number;
}) {
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));
  const paintsAnything = formatPaintsAnything(config);
  const mode = FORMAT_MODES.find((m) => m.id === config.mode);

  return (
    <MovablePanel
      title="Format"
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      onMoveTo={onMoveTo}
      onReset={onReset}
      stackBelowY={stackBelowY}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
      {...dock}
    >
      <div className="flex flex-col px-2 pb-2">
        <BrushPreview config={config} source={source} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {/* Copies is a MULTI-select, so the options are checkboxes rather
              than the radio rows the other panels use: the groups combine. */}
          <AccordionSection
            title="Copies"
            open={openRow === 'copies'}
            onToggle={() => toggle('copies')}
            headerClassName="flex w-full items-center justify-between gap-2 py-1.5 text-left"
            titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
            chevronClassName="text-slate-400 dark:text-slate-500"
            bodyClassName="pb-2"
            trailing={
              <span
                className={`truncate text-[11px] font-medium ${
                  paintsAnything
                    ? 'text-slate-600 dark:text-slate-300'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {formatCopiesSummary(config)}
              </span>
            }
          >
            <div className="flex flex-wrap gap-1">
              {FORMAT_GROUPS.map((group) => {
                const active = config.copies[group.id];
                return (
                  <Tooltip key={group.id} title={group.label} description={group.hint}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={active}
                      onClick={() => onToggleGroup(group.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                          : 'border-slate-200 text-slate-400 line-through hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-500'
                      }`}
                    >
                      {group.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </AccordionSection>
          <AccordionSection
            title="After painting"
            open={openRow === 'mode'}
            onToggle={() => toggle('mode')}
            headerClassName="flex w-full items-center justify-between gap-2 py-1.5 text-left"
            titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
            chevronClassName="text-slate-400 dark:text-slate-500"
            bodyClassName="pb-2"
            trailing={
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {mode?.label}
              </span>
            }
          >
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="After painting">
              {FORMAT_MODES.map((option) => {
                const active = option.id === config.mode;
                return (
                  <Tooltip key={option.id} title={option.label} description={option.hint}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onSetMode(option.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                          : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </AccordionSection>
        </div>
        <p
          className={`px-1 pt-1.5 text-[10px] leading-snug ${
            paintsAnything
              ? 'text-slate-400 dark:text-slate-500'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {paintsAnything
            ? 'Labels, links and comments are never copied — only the look.'
            : 'Nothing is turned on, so the brush has nothing to paint.'}
        </p>
      </div>
    </MovablePanel>
  );
}
