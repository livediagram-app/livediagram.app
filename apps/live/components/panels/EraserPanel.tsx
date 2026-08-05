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
import { ToolOptionRow } from '@/components/panels/ToolOptionRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'mode' | 'size' | 'target' | 'groups';

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
  ...placement
}: {
  config: EraserConfig;
  onChange: <K extends keyof EraserConfig>(field: K, value: EraserConfig[K]) => void;
} & ModePanelProps) {
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));

  return (
    <ModePanel helpArticle="eraser" title="Eraser" {...placement}>
      <div className="flex flex-col px-2 pb-2">
        <BrushPreview config={config} />
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
          <ToolOptionRow
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
    </ModePanel>
  );
}
