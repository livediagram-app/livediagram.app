'use client';

// The custom colour picker, opened in place by + (docs/specs/023-draw-mode/draw-mode.md "The colour
// picker"): a saturation and brightness square, a hue slider, a hex field and, where the browser has
// one, an eyedropper; Use applies it. When the colour is under 3:1 on either board, a warning says
// which and offers a nearby version readable on both, as a swatch to press; its line is always
// reserved, so it never shifts the picker. Shared with the page background's custom colours
// (page-background-custom.tsx), which preview each change and need no board warning.

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SOLID_BRAND_DARK_CONTROL, Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideTriangleAlert } from '@livediagram/icons/lucide';
import { penColourHardToSee, readablePenColour } from '@livediagram/document';
import { hexToHsv, hsvToHex, type Hsv } from '@/lib/hsv';
import { normaliseHex } from '@/lib/swatch-overrides';
import { useEyeDropper } from '@/hooks/ui/useEyeDropper';
import { PipetteIcon } from '@/components/palette/context-menu-input-rows';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 14);

// Where the square starts when there is no custom colour yet: a clear blue.
const START_HEX = '#3b82f6';
const SQUARE_STEP = 0.01;
const SQUARE_BIG_STEP = 0.1;

export function CustomColourEditor({
  start,
  onUse,
  onPreview,
  boardWarning = true,
}: {
  // The custom colour in force, if any: the editor opens on it.
  start?: string;
  onUse: (hex: string) => void;
  // Each colour as it changes, before Use.
  onPreview?: (hex: string) => void;
  // The hard-to-see warning for a marker on either board (a page background has no board).
  boardWarning?: boolean;
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(start ?? START_HEX) ?? hexToHsv(START_HEX)!);
  const hex = hsvToHex(hsv);
  const [text, setText] = useState(hex);
  const square = useRef<HTMLDivElement>(null);
  const eyeDropper = useEyeDropper();

  const set = (next: Hsv) => {
    setHsv(next);
    setText(hsvToHex(next));
    onPreview?.(hsvToHex(next));
  };
  const setHex = (value: string) => {
    const parsed = hexToHsv(value);
    if (parsed) set(parsed);
  };

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = square.current?.getBoundingClientRect();
    if (!box) return;
    const s = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    set({ ...hsv, s, v });
  };
  const squareKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? SQUARE_BIG_STEP : SQUARE_STEP;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const next =
      e.key === 'ArrowRight'
        ? { ...hsv, s: clamp(hsv.s + step) }
        : e.key === 'ArrowLeft'
          ? { ...hsv, s: clamp(hsv.s - step) }
          : e.key === 'ArrowUp'
            ? { ...hsv, v: clamp(hsv.v + step) }
            : e.key === 'ArrowDown'
              ? { ...hsv, v: clamp(hsv.v - step) }
              : null;
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    set(next);
  };

  const hard = boardWarning ? penColourHardToSee(hex) : [];
  const readable = hard.length > 0 ? readablePenColour(hex) : null;
  const hue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  return (
    <div
      className="mt-2 flex w-full flex-col gap-2 border-t border-slate-200 pt-2 dark:border-slate-700"
      data-testid="custom-colour"
    >
      <div
        ref={square}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
        }}
        onKeyDown={squareKeys}
        className="relative h-28 w-full cursor-crosshair touch-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${hue})`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(e) => set({ ...hsv, h: Number(e.target.value) })}
        className="h-3 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
      />
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-6 w-6 shrink-0 rounded-md border border-black/15 dark:border-white/20"
          style={{ backgroundColor: hex }}
        />
        <input
          type="text"
          value={text}
          aria-label="Hex"
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            const valid = normaliseHex(e.target.value);
            if (valid) {
              setHsv(hexToHsv(valid)!);
              onPreview?.(valid);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const valid = normaliseHex(text);
            if (valid) onUse(valid);
          }}
          className="h-7 w-24 rounded-md border border-slate-300 bg-transparent px-2 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-600 dark:text-slate-100"
        />
        {eyeDropper.supported ? (
          <Tooltip label="Pick a colour from the screen">
            <button
              type="button"
              aria-label="Pick a colour from the screen"
              onClick={async () => {
                const picked = await eyeDropper.pick();
                if (picked) setHex(picked);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <PipetteIcon />
            </button>
          </Tooltip>
        ) : null}
        <button
          type="button"
          onClick={() => onUse(hex)}
          className={`ml-auto h-7 rounded-md bg-brand-700 px-3 text-xs font-medium text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${SOLID_BRAND_DARK_CONTROL}`}
        >
          Use
        </button>
      </div>
      {/* The warning's line, always there so it never shifts the picker; empty until needed. */}
      {boardWarning ? (
        <div
          className="flex h-6 items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300"
          data-testid="custom-colour-note"
          role="status"
        >
          {readable ? (
            <>
              <WarningIcon aria-hidden />
              <span>Hard to see on the {hard[0]} board.</span>
              <Tooltip label={`Use ${readable}, readable on both boards`}>
                <button
                  type="button"
                  aria-label={`Use ${readable}, readable on both boards`}
                  onClick={() => onUse(readable)}
                  className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span
                    aria-hidden
                    className="block h-5 w-5 rounded-[5px] border border-black/15 dark:border-white/20"
                    style={{ backgroundColor: readable }}
                  />
                </button>
              </Tooltip>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
