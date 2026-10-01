'use client';

// What each dock flyout holds (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): a
// pen's colour and width, the eraser's mode, the Settings sections and a shape slot's menu. The
// Shapes flyout has its own component (ShapesFlyout).

import type { ReactNode } from 'react';
import {
  WHITEBOARD_BACKGROUNDS,
  WHITEBOARD_INK,
  penColourCss,
  whiteboardBackgroundOf,
  type Appearance,
} from '@livediagram/document';
import {
  WHITEBOARD_PEN_WIDTHS,
  PEN_NAMES,
  penAdjustsColour,
  type WhiteboardPen,
} from '@/lib/whiteboard-prefs';
import {
  PEN_CURSOR_VARIANTS,
  penCursorSvg,
  svgDataUrl,
  type PenCursorVariant,
} from '@/lib/whiteboard-pen-cursor';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { FlyoutHeading, FlyoutOption } from './WhiteboardFlyout';
import { ColourPicker } from './ColourPicker';
import { SnapColoursSection } from './SnapColoursSection';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { BackgroundGlyph, OffGlyph, RecogniseGlyph } from './whiteboard-icons';

const ERASER_MODES = [
  { id: 'stroke', label: 'Stroke', hint: 'Remove whole strokes' },
  { id: 'partial', label: 'Partial', hint: 'Erase part of a stroke' },
] as const;

const CURSOR_NAMES: Record<PenCursorVariant, string> = {
  dot: 'Dot',
  'nib-crosshair': 'Crosshair + nib',
};

export function PenFlyoutBody({ pen, model }: { pen: WhiteboardPen; model: WhiteboardDockModel }) {
  const { appearance } = useAppearance();
  return (
    <FlyoutRows>
      {/* The main pen always stays the board's ink: its flyout is the width only. The others get
          the colour picker (docs/specs/023-whiteboard/whiteboard.md "The colour picker"). */}
      {penAdjustsColour(pen) ? (
        <ColourPicker
          value={pen.colour}
          board={appearance}
          ink={WHITEBOARD_INK[appearance]}
          yours={model.colourMemory.yours}
          onPick={(colour) => model.updatePen(pen.id, { colour })}
          onRemove={model.colourMemory.forget}
        />
      ) : null}
      <FlyoutRow label="Width" heading>
        {WHITEBOARD_PEN_WIDTHS.map((w) => (
          <FlyoutOption
            key={w.id}
            label={w.label}
            selected={pen.width === w.px}
            onPick={() => model.updatePen(pen.id, { width: w.px })}
          >
            <WidthBar px={w.px} />
          </FlyoutOption>
        ))}
      </FlyoutRow>
    </FlyoutRows>
  );
}

// Named by its place, so "which pen am I editing" never changes under the pointer.
export const penFlyoutLabel = (pen: WhiteboardPen) => PEN_NAMES[pen.id];

export function EraserFlyoutBody({ model }: { model: WhiteboardDockModel }) {
  return (
    <div className="flex flex-col gap-1">
      {ERASER_MODES.map((m) => (
        <FlyoutOption
          key={m.id}
          wide
          label={`${m.label}: ${m.hint}`}
          selected={model.prefs.eraserMode === m.id}
          onPick={() => model.setEraserMode(m.id)}
        >
          <span className="flex w-full flex-col items-start text-left leading-tight">
            <span className="font-medium">{m.label}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{m.hint}</span>
          </span>
        </FlyoutOption>
      ))}
    </div>
  );
}

// Settings (the cog), top to bottom: Background, Cursor and Drawing, each a section of switch
// buttons (one of several), then Colours while the board has custom colours to snap.
export function SettingsFlyoutBody({
  model,
  ink,
  appearance,
}: {
  model: WhiteboardDockModel;
  ink: string;
  appearance: Appearance;
}) {
  const current = whiteboardBackgroundOf(model.background);
  return (
    <FlyoutRows>
      <FlyoutRow label="Background" heading>
        {WHITEBOARD_BACKGROUNDS.map((b) => (
          <FlyoutOption
            key={b.id}
            wide
            label={b.label}
            selected={current === b.id}
            onPick={() => model.setBackground(b.id)}
          >
            <BackgroundGlyph id={b.id} />
            <span>{b.label}</span>
          </FlyoutOption>
        ))}
      </FlyoutRow>
      {/* The pen cursor (docs/specs/023-whiteboard/whiteboard.md "Pens"), each option showing itself. */}
      <FlyoutRow label="Cursor" heading>
        {PEN_CURSOR_VARIANTS.map((v) => (
          <FlyoutOption
            key={v}
            wide
            label={CURSOR_NAMES[v]}
            selected={model.prefs.cursor === v}
            onPick={() => model.setCursor(v)}
          >
            <img
              alt=""
              aria-hidden
              width={20}
              height={20}
              src={svgDataUrl(
                penCursorSvg(v, penColourCss(model.activePen.colour, appearance, ink), appearance)
                  .svg,
              )}
            />
            <span>{CURSOR_NAMES[v]}</span>
          </FlyoutOption>
        ))}
      </FlyoutRow>
      {/* A device-local setting (docs/specs/023-whiteboard/whiteboard.md "Shape recognition"). */}
      <FlyoutRow label="Drawing" heading>
        {([false, true] as const).map((on) => (
          <FlyoutOption
            key={String(on)}
            wide
            label={on ? 'Shape recognition' : 'Basic'}
            selected={model.prefs.recognise === on}
            onPick={() => model.setRecognition(on)}
          >
            {on ? <RecogniseGlyph /> : <OffGlyph />}
            <span>{on ? 'Shape recognition' : 'Basic'}</span>
          </FlyoutOption>
        ))}
      </FlyoutRow>
      <SnapColoursSection snap={model.snapColours} />
    </FlyoutRows>
  );
}

// A shape slot's menu (docs/specs/023-whiteboard/whiteboard.md "Shape slots"): pin or unpin without
// a drag.
export function SlotMenuBody({ pinned, onChoose }: { pinned: boolean; onChoose: () => void }) {
  const label = pinned ? 'Unpin' : 'Pin to dock';
  return (
    <FlyoutOption wide label={label} selected={false} onPick={onChoose}>
      <span>{label}</span>
    </FlyoutOption>
  );
}

function FlyoutRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

// `heading`: the row is a section, headed in the flyouts' small capitals.
function FlyoutRow({
  label,
  heading = false,
  children,
}: {
  label: string;
  heading?: boolean;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label || undefined}>
      {!label ? null : heading ? (
        <FlyoutHeading className="mb-1.5">{label}</FlyoutHeading>
      ) : (
        <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      )}
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function WidthBar({ px }: { px: number }) {
  return (
    <span
      aria-hidden
      className="w-6 rounded-full bg-slate-700 dark:bg-slate-200"
      style={{ height: Math.max(1.5, px) }}
    />
  );
}
