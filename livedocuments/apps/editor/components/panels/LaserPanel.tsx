'use client';

// The Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen's settings, present only while the Laser
// tool is active, like the other mode panels down to the width and the corner it homes to.
//
// Four settings: Width, Colour, Trail, Effect. Each is a single-open accordion
// row with its current value in the collapsed header, so a closed panel is a
// four-line summary of your pen. Above them sits a LIVE PREVIEW that draws with
// the current settings, because "Comet at Bold over a long trail" means nothing
// as three words and everything as a stroke.
//
// Nothing here is a document edit: the pen is device-local (see
// lib/laser-config) and rides your laser samples so peers see the same beam.

import { useEffect, useRef, useState } from 'react';
import {
  laserLifetimeMs,
  laserStrokeWidth,
  LASER_EFFECTS,
  LASER_TRAILS,
  LASER_WIDTHS,
  type LaserConfig,
} from '@/lib/laser-config';
import { LaserOverlay } from '@/components/canvas/LaserOverlay';
import { ToolOptionRow } from '@liveworkspace/workbench/components/panels/ToolOptionRow';
import { LaserColourRow } from '@/components/panels/LaserColourRow';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';

type Row = 'width' | 'trail' | 'effect';

// The preview: a sweep drawn by the REAL overlay, so what you see here is what the canvas draws, including the
// fade, at the instant the sweep ends. It holds still (docs/specs/008-canvas/laser-panel.md "The settings"): a setting
// changed draws the sweep across once, then it rests again, so an open panel never moves on its own. With reduced
// motion it never plays.
const PREVIEW_POINTS = 24;

function sweepPoints(start: number, lifetime: number) {
  // A gentle S-curve across the box, its head reaching the end as the sweep finishes, the same shape a hand sweeping
  // across a canvas makes. Oldest first: the last point is the head.
  const draw = lifetime * 0.8;
  return Array.from({ length: PREVIEW_POINTS }, (_, i) => {
    const p = i / (PREVIEW_POINTS - 1);
    return { x: 8 + p * 208, y: 26 - Math.sin(p * Math.PI * 1.2) * 12, t: start + p * draw };
  });
}

function PenPreview({ config, colour }: { config: LaserConfig; colour: string }) {
  const lifetime = laserLifetimeMs(config);
  const draw = lifetime * 0.8;
  // The sweep playing (its start and the frame's instant), or none: at rest the preview shows the sweep's end.
  const [play, setPlay] = useState<{ start: number; at: number } | null>(null);
  const settings = `${config.width}|${config.trail}|${config.effect}|${config.colour}|${colour}`;
  const shown = useRef(settings);
  // A setting changed: play the sweep once, from its first point to its head, then rest on its end.
  useEffect(() => {
    if (settings === shown.current) return;
    shown.current = settings;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const at = performance.now();
      if (at >= start + draw) return setPlay(null);
      setPlay({ start, at });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      setPlay(null);
    };
  }, [settings, draw]);
  const sweep = play ?? { start: 0, at: draw };
  const points = sweepPoints(sweep.start, lifetime).filter((p) => p.t <= sweep.at);

  return (
    <div
      data-laser-preview={play ? 'playing' : 'still'}
      className="relative mb-1 h-14 overflow-hidden rounded-lg bg-slate-900/95 dark:bg-slate-950"
    >
      {/* The preview's box is dark, so a standard colour draws in its dark-canvas version. */}
      <CanvasSurfaceProvider surface="dark">
        <LaserOverlay
          zoom={1}
          frozenAt={sweep.at}
          trails={
            points.length > 0 ? [{ participantId: 'preview', color: colour, points, config }] : []
          }
        />
      </CanvasSurfaceProvider>
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

  return (
    <ModePanel helpArticle="laser" title="Laser" {...placement}>
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
          <LaserColourRow
            config={config}
            selfColour={selfColour}
            onOpen={() => setOpenRow(null)}
            onPick={(colour) => onChange('colour', colour)}
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
        <p className="px-1 pt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Everyone in the room sees your pen, and it is remembered on this device:{' '}
          {laserStrokeWidth(config)}px, fading over {(laserLifetimeMs(config) / 1000).toFixed(1)}s.
        </p>
      </div>
    </ModePanel>
  );
}
