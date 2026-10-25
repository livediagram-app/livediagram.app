'use client';

// A gradient option (docs/specs/031-photo/photo-tools.md "Fills and gradients"): a strip showing the
// gradient; a press opens the gradient editor. The editor holds the presets, then the strip with its opacity
// stops above and its colour stops below, each draggable along it, added by a press beside the strip and
// removed by dragging off it; the chosen stop's colour or opacity and its location sit under the strip.
// Shared by the Gradient tool's options and the Gradient Map adjustment.
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Gradient } from '@livedesign/photo-engine';
import { Button, Tooltip } from '@livedesign/ui';
import { standardGroup } from '@/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { PREVIEW_CHECKER } from '@/components/dialogs/ImageExportPanel';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import {
  gradientCss,
  gradientPresets,
  movedStop,
  STOP_REMOVE_PX,
  withoutStop,
  withStop,
  type StopKind,
} from '@/lib/photo-editor/gradient-edit';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { OptionSlider } from './photo-controls';

const STANDARD = [standardGroup('strong', 'light', 'hex')];
const KEEP_OPEN = '[data-colour-picker],[data-anchored-popover]';
const EDITOR_WIDTH = 296;

type Chosen = { kind: StopKind; index: number };

function Strip({ gradient, reverse }: { gradient: Gradient; reverse?: boolean }) {
  return (
    <span
      aria-hidden
      className="block h-full w-full rounded-[3px]"
      style={{ background: `${gradientCss(gradient, reverse)}, ${PREVIEW_CHECKER}` }}
    />
  );
}

function StopMarker({
  kind,
  at,
  fill,
  chosen,
  leaving,
  label,
  onPointerDown,
}: {
  kind: StopKind;
  at: number;
  fill: string;
  chosen: boolean;
  leaving: boolean;
  label: string;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={chosen}
      onPointerDown={onPointerDown}
      className={`absolute h-3.5 w-3 -translate-x-1/2 touch-none border ${
        kind === 'opacity' ? 'top-0 rounded-t-sm' : 'bottom-0 rounded-b-sm'
      } ${chosen ? 'border-brand-600 ring-2 ring-brand-500/50' : 'border-slate-500'} ${
        leaving ? 'opacity-30' : ''
      }`}
      style={{ left: `${at * 100}%`, background: fill }}
    />
  );
}

export function GradientEditor({
  value,
  onChange,
}: {
  value: Gradient;
  onChange: (g: Gradient) => void;
}) {
  const [chosen, setChosen] = useState<Chosen | null>({ kind: 'colour', index: 0 });
  const [leaving, setLeaving] = useState<Chosen | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const { foreground, background } = photoTools.get();
  const tAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
  };
  // A stop held from a press: dragged along the strip, and let go of past STOP_REMOVE_PX off it, removed.
  const drag = (e: ReactPointerEvent, g: Gradient, stop: Chosen) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const rowY = e.clientY;
    let now = g;
    let at = stop;
    let off = false;
    setChosen(stop);
    const move = (ev: PointerEvent) => {
      off = Math.abs(ev.clientY - rowY) > STOP_REMOVE_PX;
      setLeaving(off ? at : null);
      const next = movedStop(now, at.kind, at.index, tAt(ev.clientX));
      now = next.gradient;
      at = { kind: at.kind, index: next.index };
      setChosen(at);
      onChange(now);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setLeaving(null);
      if (!off) return;
      const left = withoutStop(now, at.kind, at.index);
      if (left !== now) {
        setChosen(null);
        onChange(left);
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const addAt = (e: ReactPointerEvent, kind: StopKind) => {
    const { gradient, index } = withStop(value, kind, tAt(e.clientX));
    onChange(gradient);
    drag(e, gradient, { kind, index });
  };
  const colourStop = chosen?.kind === 'colour' ? value.colours[chosen.index] : undefined;
  const opacityStop = chosen?.kind === 'opacity' ? value.opacities[chosen.index] : undefined;
  const stop = colourStop ?? opacityStop;
  const set = (patch: { at?: number; colour?: string; opacity?: number }) => {
    if (!chosen || !stop) return;
    const next = movedStop(value, chosen.kind, chosen.index, patch.at ?? stop.at, patch);
    setChosen({ kind: chosen.kind, index: next.index });
    onChange(next.gradient);
  };
  const remove = () => {
    if (!chosen) return;
    const left = withoutStop(value, chosen.kind, chosen.index);
    if (left === value) return;
    setChosen(null);
    onChange(left);
  };
  const many = chosen?.kind === 'colour' ? value.colours.length > 1 : value.opacities.length > 1;
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 p-3"
      data-photo-gradient-editor=""
    >
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Presets
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {gradientPresets(foreground, background).map((p) => (
            <Tooltip key={p.name} label={p.name}>
              <button
                type="button"
                aria-label={p.name}
                onClick={() => {
                  setChosen({ kind: 'colour', index: 0 });
                  onChange(p.gradient);
                }}
                className="h-6 rounded border border-slate-200 p-0.5 hover:border-brand-500 dark:border-slate-700"
              >
                <Strip gradient={p.gradient} />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="px-1.5">
        <div
          ref={track}
          role="group"
          aria-label="Gradient Stops"
          className="relative flex flex-col gap-0.5"
        >
          <div
            className="relative h-3.5 cursor-copy touch-none"
            onPointerDown={(e) => addAt(e, 'opacity')}
          >
            {value.opacities.map((s, i) => (
              <StopMarker
                key={`o${i}`}
                kind="opacity"
                at={s.at}
                fill={`rgba(0, 0, 0, ${s.opacity})`}
                chosen={chosen?.kind === 'opacity' && chosen.index === i}
                leaving={leaving?.kind === 'opacity' && leaving.index === i}
                label={`Opacity stop at ${Math.round(s.at * 100)}%`}
                onPointerDown={(e) => drag(e, value, { kind: 'opacity', index: i })}
              />
            ))}
          </div>
          <div className="h-6 rounded border border-slate-300 dark:border-slate-600">
            <Strip gradient={value} />
          </div>
          <div
            className="relative h-3.5 cursor-copy touch-none"
            onPointerDown={(e) => addAt(e, 'colour')}
          >
            {value.colours.map((s, i) => (
              <StopMarker
                key={`c${i}`}
                kind="colour"
                at={s.at}
                fill={s.colour}
                chosen={chosen?.kind === 'colour' && chosen.index === i}
                leaving={leaving?.kind === 'colour' && leaving.index === i}
                label={`Colour stop at ${Math.round(s.at * 100)}%`}
                onPointerDown={(e) => drag(e, value, { kind: 'colour', index: i })}
              />
            ))}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          Press beside the strip to add a stop; drag one off to remove it.
        </p>
      </div>
      {stop ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          {colourStop ? (
            <label className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
              Colour
              <ColourSwatchButton
                label="Stop Colour"
                swatch={colourStop.colour}
                value={colourStop.colour}
                standard={STANDARD}
                onPick={(id) => /^#[0-9a-f]{6}$/i.test(id) && set({ colour: id.toLowerCase() })}
              />
            </label>
          ) : null}
          {opacityStop ? (
            <OptionSlider
              label="Opacity"
              value={opacityStop.opacity}
              min={0}
              max={1}
              step={0.01}
              unit="%"
              scale={100}
              onChange={(opacity) => set({ opacity })}
            />
          ) : null}
          <OptionSlider
            label="Location"
            value={stop.at}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            onChange={(at) => set({ at })}
          />
          <Button size="sm" variant="secondary" disabled={!many} onClick={remove}>
            Delete Stop
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PhotoGradientField({
  label,
  value,
  reverse,
  onChange,
}: {
  label: string;
  value: Gradient;
  reverse?: boolean;
  onChange: (g: Gradient) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label={label}>
        <button
          ref={setAnchor}
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="h-6 w-24 shrink-0 rounded border border-slate-300 p-0.5 hover:border-brand-500 dark:border-slate-600"
        >
          <Strip gradient={value} reverse={reverse} />
        </button>
      </Tooltip>
      {open && anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Gradient Editor"
          width={EDITOR_WIDTH}
          onClose={() => setOpen(false)}
          keepOpenWithin={KEEP_OPEN}
        >
          <GradientEditor value={value} onChange={onChange} />
        </AnchoredPopover>
      ) : null}
    </>
  );
}
