'use client';

// The Spotlight Panel (spec/112): size, shroud darkness, edge softness, and
// shape — the Laser Panel's sibling, and mounted on the same terms (present
// only while the mode is, Palette width, top-right under it, its own dock
// button in the minimal layout).
//
// The one difference is the closing line: the laser's pen travels to everyone
// in the room, and the spotlight's shroud does not. Saying so in the panel
// stops a presenter believing they have dimmed the room's diagram when they
// have only dimmed their own.

import { useState } from 'react';
import {
  spotlightExtent,
  spotlightFeather,
  spotlightRadius,
  spotlightShroud,
  spotlightSizeOf,
  SPOTLIGHT_DIMS,
  SPOTLIGHT_EDGES,
  SPOTLIGHT_SHAPES,
  SPOTLIGHT_SIZES,
  type SpotlightConfig,
} from '@/lib/spotlight-config';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';

type Row = 'size' | 'dim' | 'edge' | 'shape';

function OptionRow<T extends string>({
  label,
  options,
  value,
  valueLabel,
  open,
  onToggle,
  onPick,
}: {
  label: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T | null;
  // What the collapsed header shows. Usually the option's own label, but the
  // Size row says "Custom" when a click has nudged the radius off a preset.
  valueLabel: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: T) => void;
}) {
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
          {valueLabel}
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

// A miniature of the real thing: the same gradient recipe over a scrap of
// "diagram", so Blackout-with-a-crisp-edge can be seen before it is inflicted
// on the room. Scaled down by a fixed factor rather than by the live radius,
// so the preview stays a preview and not a peephole.
function ShroudPreview({ config, radius }: { config: SpotlightConfig; radius: number }) {
  const scale = 0.26;
  const { rx, ry } = spotlightExtent(config, radius * scale);
  const feather = spotlightFeather(config) * scale;
  const core = Math.max(0, radius * scale - feather);
  const corePct = radius === 0 ? 0 : Math.round((core / (radius * scale)) * 100);
  return (
    <div className="relative mb-1 h-14 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      {/* Stand-in diagram content, so the shroud has something to dim. */}
      <div className="absolute inset-0 flex items-center justify-around px-3">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-6 w-9 rounded bg-slate-300 dark:bg-slate-600" />
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(${rx}px ${ry}px at 50% 50%, transparent ${corePct}%, ${spotlightShroud(config)} 100%)`,
        }}
      />
    </div>
  );
}

export function SpotlightPanel({
  config,
  onChange,
  radius,
  onSetRadius,
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
  config: SpotlightConfig;
  onChange: <K extends keyof SpotlightConfig>(field: K, value: SpotlightConfig[K]) => void;
  // The live radius, which clicking the canvas also changes (spec/09) — so the
  // Size row reads from it rather than from the stored preset, and says
  // "Custom" when the two have parted company.
  radius: number;
  onSetRadius: (radius: number) => void;
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
  const currentSize = spotlightSizeOf(radius);
  const labelOf = <T extends string>(options: readonly { id: T; label: string }[], id: T) =>
    options.find((o) => o.id === id)?.label ?? '';

  return (
    <MovablePanel
      title="Spotlight"
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
        <ShroudPreview config={config} radius={radius} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <OptionRow
            label="Size"
            options={SPOTLIGHT_SIZES}
            value={currentSize}
            valueLabel={currentSize ? labelOf(SPOTLIGHT_SIZES, currentSize) : 'Custom'}
            open={openRow === 'size'}
            onToggle={() => toggle('size')}
            // Picking a size sets the live radius; clicking the canvas can
            // still move it off again, which is what "Custom" then reports.
            onPick={(id) => {
              onChange('size', id);
              onSetRadius(spotlightRadius(id));
            }}
          />
          <OptionRow
            label="Dim"
            options={SPOTLIGHT_DIMS}
            value={config.dim}
            valueLabel={labelOf(SPOTLIGHT_DIMS, config.dim)}
            open={openRow === 'dim'}
            onToggle={() => toggle('dim')}
            onPick={(id) => onChange('dim', id)}
          />
          <OptionRow
            label="Edge"
            options={SPOTLIGHT_EDGES}
            value={config.edge}
            valueLabel={labelOf(SPOTLIGHT_EDGES, config.edge)}
            open={openRow === 'edge'}
            onToggle={() => toggle('edge')}
            onPick={(id) => onChange('edge', id)}
          />
          <OptionRow
            label="Shape"
            options={SPOTLIGHT_SHAPES}
            value={config.shape}
            valueLabel={labelOf(SPOTLIGHT_SHAPES, config.shape)}
            open={openRow === 'shape'}
            onToggle={() => toggle('shape')}
            onPick={(id) => onChange('shape', id)}
          />
        </div>
        <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Only you see the shroud — everyone else sees the whole diagram. Click the canvas to grow
          the light, right-click to shrink it.
        </p>
      </div>
    </MovablePanel>
  );
}
