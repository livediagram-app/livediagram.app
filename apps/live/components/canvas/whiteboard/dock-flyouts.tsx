'use client';

// What each dock flyout holds (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): a
// pen's colour and width, the eraser's mode, the Shapes flyout, the Settings sections and a shape
// slot's menu. The More shapes search has its own component (ShapeSearch).

import type { ReactNode } from 'react';
import {
  WHITEBOARD_BACKGROUNDS,
  whiteboardBackgroundOf,
  type Appearance,
} from '@livediagram/document';
import {
  WHITEBOARD_PEN_COLOURS,
  WHITEBOARD_PEN_WIDTHS,
  PEN_NAMES,
  penAdjustsColour,
  type WhiteboardPen,
} from '@/lib/whiteboard-prefs';
import { WHITEBOARD_SHAPES, type WhiteboardShapeId } from '@/lib/whiteboard-tool';
import { WHITEBOARD_DOCK_MODES } from '@/lib/whiteboard-dock-prefs';
import {
  PEN_CURSOR_VARIANTS,
  penCursorSvg,
  svgDataUrl,
  type PenCursorVariant,
} from '@/lib/whiteboard-pen-cursor';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { FlyoutHeading, FlyoutOption } from './WhiteboardFlyout';
import { BackgroundGlyph, OffGlyph, RecogniseGlyph, ShapeGlyph } from './whiteboard-icons';

const ERASER_MODES = [
  { id: 'stroke', label: 'Stroke', hint: 'Remove whole strokes' },
  { id: 'partial', label: 'Partial', hint: 'Erase part of a stroke' },
] as const;

const CURSOR_NAMES: Record<PenCursorVariant, string> = {
  dot: 'Dot',
  'nib-crosshair': 'Crosshair + nib',
};

export function PenFlyoutBody({ pen, model }: { pen: WhiteboardPen; model: WhiteboardDockModel }) {
  return (
    <FlyoutRows>
      {/* The main pen always stays the board's ink: its flyout is the width only. */}
      {penAdjustsColour(pen) ? (
        <FlyoutRow label="Colour">
          {WHITEBOARD_PEN_COLOURS.map((c) => (
            <FlyoutOption
              key={c.label}
              label={c.label}
              selected={pen.colour === c.hex}
              onPick={() => model.updatePen(pen.id, { colour: c.hex })}
            >
              <Swatch colour={c.hex} />
            </FlyoutOption>
          ))}
        </FlyoutRow>
      ) : null}
      <FlyoutRow label="Width">
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

export function ShapesFlyoutBody({ onPick }: { onPick: (id: WhiteboardShapeId) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {WHITEBOARD_SHAPES.map((s) => (
        <FlyoutOption
          key={s.id}
          label={s.label}
          shortcut={WHITEBOARD_TOOL_KEYS[s.id]}
          selected={false}
          onPick={() => onPick(s.id)}
        >
          <ShapeGlyph id={s.id} />
        </FlyoutOption>
      ))}
    </div>
  );
}

// Settings (the cog), top to bottom: Background, Cursor, Drawing and Mode, each a section of
// switch buttons.
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
              src={svgDataUrl(penCursorSvg(v, model.activePen.colour ?? ink, appearance).svg)}
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
      {/* Dock modes (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"): synced per
          user. Full drawing is shown, but not selectable yet. */}
      <FlyoutRow label="Mode" heading>
        {WHITEBOARD_DOCK_MODES.map((m) =>
          m.comingSoon ? (
            <FlyoutOption
              key={m.id}
              wide
              unavailable
              label={`${m.label}, coming soon`}
              selected={false}
              onPick={() => {}}
            >
              <span className="flex flex-col items-start text-left leading-tight text-slate-500 dark:text-slate-400">
                <span>{m.label}</span>
                <span className="text-[11px]">Coming soon</span>
              </span>
            </FlyoutOption>
          ) : (
            <FlyoutOption
              key={m.id}
              wide
              label={m.label}
              selected={model.dockMode === m.id}
              onPick={() => model.setDockMode(m.id as 'simple' | 'shapes')}
            >
              <span>{m.label}</span>
            </FlyoutOption>
          ),
        )}
      </FlyoutRow>
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

function Swatch({ colour }: { colour: string }) {
  return (
    <span
      aria-hidden
      className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-600"
      style={{ backgroundColor: colour }}
    />
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
