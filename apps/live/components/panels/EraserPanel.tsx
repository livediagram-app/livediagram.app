'use client';

// The Eraser Panel (spec/113): mode, size, what it may erase, and what it does
// with a group — the fourth mode panel, on the same terms as the Laser and
// Spotlight ones.
//
// The preview here matters more than in the other two: this is the tool that
// destroys work, so the brush is drawn at its true radius over a scrap of
// "diagram", and the ring turns amber whenever a target filter is on. A
// restricted eraser that looks identical to an unrestricted one is how someone
// concludes the eraser is broken.

import { useState } from 'react';
import {
  eraserRadius,
  ERASER_GROUPS,
  ERASER_MODES,
  ERASER_SIZES,
  ERASER_TARGETS,
  type EraserConfig,
} from '@/lib/eraser-config';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';

type Row = 'mode' | 'size' | 'target' | 'groups';

function OptionRow<T extends string>({
  label,
  options,
  value,
  open,
  onToggle,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  open: boolean;
  onToggle: () => void;
  onPick: (id: T) => void;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <AccordionSection
      title={label}
      open={open}
      onToggle={onToggle}
      headerClassName="flex w-full items-center justify-between gap-2 py-1.5 text-left"
      titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
      chevronClassName="text-slate-400 dark:text-slate-500"
      bodyClassName="pb-2"
      trailing={
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {current?.label}
        </span>
      }
    >
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = option.id === value;
          const button = (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPick(option.id)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500'
              }`}
            >
              {option.label}
            </button>
          );
          return option.hint ? (
            <Tooltip key={option.id} title={option.label} description={option.hint}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </div>
    </AccordionSection>
  );
}

// The brush at its true size over a scrap of diagram, so "Large" is a size
// rather than a word. Capped to the preview box: a 72px radius is bigger than
// the panel is tall, and a preview that overflows teaches nothing.
function BrushPreview({ config }: { config: EraserConfig }) {
  const radius = Math.min(eraserRadius(config), 26);
  const filtered = config.target !== 'anything';
  return (
    <div className="relative mb-1 flex h-14 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      <div className="absolute inset-0 flex items-center justify-around px-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-6 w-9 rounded bg-slate-300 dark:bg-slate-600" />
        ))}
      </div>
      {/* The brush. A filtered eraser is amber, matching the canvas ring, so
          the two never disagree about whether a filter is on. */}
      <span
        aria-hidden
        className={`relative rounded-full border-2 ${
          filtered
            ? 'border-amber-500 bg-amber-400/25'
            : 'border-slate-500 bg-white/70 dark:border-slate-300 dark:bg-slate-900/60'
        }`}
        style={{ width: Math.max(8, radius * 2), height: Math.max(8, radius * 2) }}
      />
    </div>
  );
}

export function EraserPanel({
  config,
  onChange,
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
  config: EraserConfig;
  onChange: <K extends keyof EraserConfig>(field: K, value: EraserConfig[K]) => void;
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

  return (
    <MovablePanel
      title="Eraser"
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
        <BrushPreview config={config} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <OptionRow
            label="Mode"
            options={ERASER_MODES}
            value={config.mode}
            open={openRow === 'mode'}
            onToggle={() => toggle('mode')}
            onPick={(id) => onChange('mode', id)}
          />
          <OptionRow
            label="Size"
            options={ERASER_SIZES}
            value={config.size}
            open={openRow === 'size'}
            onToggle={() => toggle('size')}
            onPick={(id) => onChange('size', id)}
          />
          <OptionRow
            label="Erases"
            options={ERASER_TARGETS}
            value={config.target}
            open={openRow === 'target'}
            onToggle={() => toggle('target')}
            onPick={(id) => onChange('target', id)}
          />
          <OptionRow
            label="Groups"
            options={ERASER_GROUPS}
            value={config.groups}
            open={openRow === 'groups'}
            onToggle={() => toggle('groups')}
            onPick={(id) => onChange('groups', id)}
          />
        </div>
        <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          {config.target === 'anything'
            ? 'Locked elements and locked layers are never erased. One sweep is one undo.'
            : `Erasing ${config.target === 'drawings' ? 'drawings' : 'arrows'} only — everything else is safe from the brush.`}
        </p>
      </div>
    </MovablePanel>
  );
}
