'use client';

// The Eraser Panel (docs/specs/008-canvas/eraser-panel.md): mode, size and what it may erase — the fourth
// mode panel, on the same terms as the Laser and
// Spotlight ones.
//
// The preview here matters more than in the other two: this is the tool that
// destroys work, so the brush is drawn at its true radius over a scrap of
// "canvas", and the ring turns amber whenever a target filter is on. A
// restricted eraser that looks identical to an unrestricted one is how someone
// concludes the eraser is broken.

import { useState, type ReactNode } from 'react';
import { ToolOptionRow } from './ToolOptionRow';

type Row = 'mode' | 'size' | 'target';

// The eraser's settings, as each editor's `lib/eraser-config` defines them (device-local, never sent to the api).
type EraserMode = 'sweep' | 'tap';
type EraserSize = 'point' | 'small' | 'medium' | 'large';
type EraserTarget = 'anything' | 'drawings' | 'arrows';
type EraserConfig = { mode: EraserMode; size: EraserSize; target: EraserTarget };

// The brush at its true size over a scrap of canvas, so "Large" is a size
// rather than a word. Capped to the preview box: a 72px radius is bigger than
// the panel is tall, and a preview that overflows teaches nothing.
function BrushPreview({ config, trueRadius }: { config: EraserConfig; trueRadius: number }) {
  const radius = Math.min(trueRadius, 26);
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

// What an editor hands the panel: its ModePanel (the chrome every mode panel wears, typed on the editor's placement
// props `P`) and its eraser's options and radius (its `lib/eraser-config`).
export type EraserPanelDeps<P> = {
  ModePanel: (props: P & { title: string; helpArticle: 'eraser'; children: ReactNode }) => ReactNode;
  eraserRadius: (config: EraserConfig) => number;
  ERASER_MODES: readonly { id: EraserMode; label: string; hint: string }[];
  ERASER_SIZES: readonly { id: EraserSize; label: string }[];
  ERASER_TARGETS: readonly { id: EraserTarget; label: string; hint: string }[];
};

/** The Eraser Panel, made once per editor at module scope with its placement props `P`. */
export function createEraserPanel<P extends object>({
  ModePanel,
  eraserRadius,
  ERASER_MODES,
  ERASER_SIZES,
  ERASER_TARGETS,
}: EraserPanelDeps<P>) {
  function EraserPanel({
    config,
    onChange,
    ...placement
  }: {
    config: EraserConfig;
    onChange: <K extends keyof EraserConfig>(field: K, value: EraserConfig[K]) => void;
  } & P) {
    const [openRow, setOpenRow] = useState<Row | null>(null);
    const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));

    return (
      <ModePanel helpArticle="eraser" title="Eraser" {...(placement as unknown as P)}>
        <div className="flex flex-col px-2 pb-2">
          <BrushPreview config={config} trueRadius={eraserRadius(config)} />
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <ToolOptionRow
              label="Mode"
              options={ERASER_MODES}
              value={config.mode}
              open={openRow === 'mode'}
              onToggle={() => toggle('mode')}
              onPick={(id) => onChange('mode', id)}
            />
            <ToolOptionRow
              label="Size"
              options={ERASER_SIZES}
              value={config.size}
              open={openRow === 'size'}
              onToggle={() => toggle('size')}
              onPick={(id) => onChange('size', id)}
            />
            <ToolOptionRow
              label="Erases"
              options={ERASER_TARGETS}
              value={config.target}
              open={openRow === 'target'}
              onToggle={() => toggle('target')}
              onPick={(id) => onChange('target', id)}
            />
          </div>
          <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {config.target === 'anything'
              ? 'Locked elements and locked layers are never erased. One sweep is one undo.'
              : `Erasing ${config.target === 'drawings' ? 'drawings' : 'arrows'} only; everything else is safe from the brush.`}
          </p>
        </div>
      </ModePanel>
    );
  }

  return EraserPanel;
}
