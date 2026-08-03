'use client';

// The Laser Panel (spec/111): the pen's settings, present only while the Laser
// tool is active — the same relationship the Avatar Panel has with Avatar mode,
// down to the width, the corner it homes to, and the mobile dock button.
//
// Four settings: Width, Colour, Trail, Effect. Each is a single-open accordion
// row with its current value in the collapsed header, so a closed panel is a
// four-line summary of your pen. Above them sits a LIVE PREVIEW that draws with
// the current settings, because "Comet at Bold over a long trail" means nothing
// as three words and everything as a stroke.
//
// Nothing here is a diagram edit: the pen is device-local (see
// lib/laser-config) and rides your laser samples so peers see the same beam.

import { useEffect, useRef, useState } from 'react';
import {
  laserColour,
  laserLifetimeMs,
  laserStrokeWidth,
  LASER_COLOURS,
  LASER_EFFECTS,
  LASER_TRAILS,
  LASER_WIDTHS,
  type LaserConfig,
} from '@/lib/laser-config';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { ToolOptionRow } from '@/components/panels/ToolOptionRow';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'width' | 'colour' | 'trail' | 'effect';

// The preview: a looping sweep drawn by the REAL overlay, so what you see here
// is what the canvas draws — including the fade, which a static swatch of a
// stroke can't show. Points are regenerated on a timer with fresh timestamps so
// the trail keeps sweeping instead of fading out and staying gone.
function PenPreview({ config, colour }: { config: LaserConfig; colour: string }) {
  const [tick, setTick] = useState(0);
  const lifetime = laserLifetimeMs(config);
  useEffect(() => {
    // Redraw a sweep a little more often than the trail's own lifetime, so
    // there is always a stroke on screen at every trail length.
    const id = window.setInterval(() => setTick((t) => t + 1), Math.max(500, lifetime * 0.6));
    return () => window.clearInterval(id);
  }, [lifetime]);

  // A gentle S-curve across the box, sampled back in time so the tail is
  // already fading when it appears — the same shape a hand sweeping across a
  // diagram makes.
  const startedAt = useRef(performance.now());
  startedAt.current = performance.now();
  const points = Array.from({ length: 24 }, (_, i) => {
    const p = i / 23;
    return {
      x: 8 + p * 208,
      y: 26 - Math.sin(p * Math.PI * 1.2) * 12,
      // Oldest first: the last point is "now", so the head sits at the end.
      t: startedAt.current - (1 - p) * lifetime * 0.8,
    };
  });

  return (
    <div className="relative mb-1 h-14 overflow-hidden rounded-lg bg-slate-900/95 dark:bg-slate-950">
      <LaserOverlay
        key={tick}
        zoom={1}
        trails={[{ participantId: 'preview', color: colour, points, config }]}
      />
    </div>
  );
}

export function LaserPanel({
  config,
  onChange,
  selfColour,
  ...placement
}: {
  config: LaserConfig;
  // One field at a time — the hook persists and reports each pick.
  onChange: <K extends keyof LaserConfig>(field: K, value: LaserConfig[K]) => void;
  // The local participant's colour, so "Your colour" previews as itself.
  selfColour: string;
} & ModePanelProps) {
  const [openRow, setOpenRow] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpenRow((r) => (r === row ? null : row));
  const swatchFor = (id: LaserConfig['colour']) =>
    laserColour({ ...config, colour: id }, selfColour);

  return (
    <ModePanel title="Laser" {...placement}>
      <div className="flex flex-col px-2 pb-2">
        <PenPreview config={config} colour={selfColour} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <ToolOptionRow
            label="Width"
            options={LASER_WIDTHS}
            value={config.width}
            open={openRow === 'width'}
            onToggle={() => toggle('width')}
            onPick={(id) => onChange('width', id)}
          />
          <ToolOptionRow
            label="Colour"
            options={LASER_COLOURS}
            value={config.colour}
            open={openRow === 'colour'}
            onToggle={() => toggle('colour')}
            onPick={(id) => onChange('colour', id)}
            swatchFor={swatchFor}
          />
          <ToolOptionRow
            label="Trail"
            options={LASER_TRAILS}
            value={config.trail}
            open={openRow === 'trail'}
            onToggle={() => toggle('trail')}
            onPick={(id) => onChange('trail', id)}
          />
          <ToolOptionRow
            label="Effect"
            options={LASER_EFFECTS}
            value={config.effect}
            open={openRow === 'effect'}
            onToggle={() => toggle('effect')}
            onPick={(id) => onChange('effect', id)}
          />
        </div>
        <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Everyone in the room sees your pen, and it is remembered on this device —{' '}
          {laserStrokeWidth(config)}px, fading over {(laserLifetimeMs(config) / 1000).toFixed(1)}s.
        </p>
      </div>
    </ModePanel>
  );
}
