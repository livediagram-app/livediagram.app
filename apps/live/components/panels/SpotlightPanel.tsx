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
import { ToolOptionRow } from '@/components/panels/ToolOptionRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'size' | 'dim' | 'edge' | 'shape';

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
  ...placement
}: {
  config: SpotlightConfig;
  onChange: <K extends keyof SpotlightConfig>(field: K, value: SpotlightConfig[K]) => void;
  // The live radius, which clicking the canvas also changes (spec/09) — so the
  // Size row reads from it rather than from the stored preset, and says
  // "Custom" when the two have parted company.
  radius: number;
  onSetRadius: (radius: number) => void;
} & ModePanelProps) {
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));
  const currentSize = spotlightSizeOf(radius);
  const labelOf = <T extends string>(options: readonly { id: T; label: string }[], id: T) =>
    options.find((o) => o.id === id)?.label ?? '';

  return (
    <ModePanel helpArticle="spotlight" title="Spotlight" {...placement}>
      <div className="flex flex-col px-2 pb-2">
        <ShroudPreview config={config} radius={radius} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <ToolOptionRow
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
          <ToolOptionRow
            label="Dim"
            options={SPOTLIGHT_DIMS}
            value={config.dim}
            valueLabel={labelOf(SPOTLIGHT_DIMS, config.dim)}
            open={openRow === 'dim'}
            onToggle={() => toggle('dim')}
            onPick={(id) => onChange('dim', id)}
          />
          <ToolOptionRow
            label="Edge"
            options={SPOTLIGHT_EDGES}
            value={config.edge}
            valueLabel={labelOf(SPOTLIGHT_EDGES, config.edge)}
            open={openRow === 'edge'}
            onToggle={() => toggle('edge')}
            onPick={(id) => onChange('edge', id)}
          />
          <ToolOptionRow
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
    </ModePanel>
  );
}
