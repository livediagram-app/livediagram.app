'use client';

// The whiteboard's floating dock (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"):
// every drawing tool in one bottom-centre toolbar, in place of the palette.
// Buttons are fixed-size and flyouts open ABOVE the dock, so nothing moves
// under the pointer when a tool is picked. One tab stop; the arrow keys walk
// the buttons (WAI-ARIA toolbar pattern).

import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';
import { WHITEBOARD_BACKGROUNDS, whiteboardBackgroundOf } from '@livediagram/document';
import { EraserIcon, SelectIcon } from '@/components/palette/palette-icons';
import {
  WHITEBOARD_PEN_COLOURS,
  WHITEBOARD_PEN_WIDTHS,
  PEN_NAMES,
  penAdjustsColour,
  penLabel,
  type WhiteboardPenId,
} from '@/lib/whiteboard-prefs';
import { WHITEBOARD_SHAPES } from '@/lib/whiteboard-tool';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { FlyoutOption, WhiteboardFlyout } from './WhiteboardFlyout';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import {
  BackgroundGlyph,
  DOCK_ICON_PX,
  MoreGlyph,
  PenGlyph,
  RecogniseGlyph,
  RedoGlyph,
  ShapeGlyph,
  ShapesGlyph,
  StickyGlyph,
  TextGlyph,
  UndoGlyph,
} from './whiteboard-icons';

type Flyout = {
  kind: WhiteboardPenId | 'eraser' | 'shapes' | 'more';
  left: number;
};

const ERASER_MODES = [
  { id: 'stroke', label: 'Stroke', hint: 'Remove whole strokes' },
  { id: 'partial', label: 'Partial', hint: 'Erase part of a stroke' },
] as const;

export type WhiteboardDockProps = {
  model: WhiteboardDockModel;
  // The board's ink for this appearance: what the main pen draws with.
  ink: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function WhiteboardDock({
  model,
  ink,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: WhiteboardDockProps) {
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  // The roving tab stop, by the button's data-dock-item key.
  const [focusKey, setFocusKey] = useState('select');
  const { tool, prefs } = model;

  const openerOf = (kind: Flyout['kind']) =>
    document.querySelector<HTMLElement>(`[data-whiteboard-dock] [data-dock-item="${kind}"]`);

  const toggleFlyout = (kind: Flyout['kind'], opener: HTMLElement) => {
    if (flyout?.kind === kind) {
      setFlyout(null);
      return;
    }
    // Measured once, on the press: the flyout is placed, never re-laid out.
    const wrap = opener.closest('[data-whiteboard-dock]')?.getBoundingClientRect();
    const btn = opener.getBoundingClientRect();
    setFlyout({ kind, left: wrap ? btn.left + btn.width / 2 - wrap.left : 0 });
  };

  const closeFlyout = (returnFocus: boolean) => {
    const kind = flyout?.kind;
    setFlyout(null);
    if (returnFocus && kind) openerOf(kind)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-dock-item]'),
    ).filter((b) => !b.disabled);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    const target = items[next]!;
    setFocusKey(target.dataset.dockItem ?? 'select');
    target.focus();
  };

  // One dock button. `pressed` is a tool in hand or a toggle on; `flyoutKind`
  // marks an opener, with aria-expanded / aria-controls.
  const item = (o: {
    key: string;
    label: string;
    icon: ReactNode;
    onPress: (el: HTMLElement) => void;
    pressed?: boolean;
    flyoutKind?: Flyout['kind'];
    disabled?: boolean;
    // The key that picks this tool (docs/specs/023-whiteboard/whiteboard.md "Keyboard shortcuts").
    shortcut?: string;
  }) => (
    <Tooltip label={o.label}>
      <button
        type="button"
        data-dock-item={o.key}
        aria-label={o.label}
        aria-pressed={o.pressed}
        aria-keyshortcuts={o.shortcut}
        aria-expanded={o.flyoutKind ? flyout?.kind === o.flyoutKind : undefined}
        aria-controls={o.flyoutKind ? `whiteboard-flyout-${o.flyoutKind}` : undefined}
        aria-haspopup={o.flyoutKind ? 'true' : undefined}
        disabled={o.disabled}
        tabIndex={focusKey === o.key ? 0 : -1}
        onFocus={() => setFocusKey(o.key)}
        onClick={(e) => o.onPress(e.currentTarget)}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
          o.pressed
            ? 'bg-brand-50 text-brand-700 ring-2 ring-inset ring-brand-500 dark:bg-brand-500/15 dark:text-brand-200'
            : ''
        }`}
      >
        {o.icon}
        {o.shortcut ? (
          // Shown the whole time, as the Toolbar layout's strip does: a tool
          // bar is where people learn the keys. Slate-500 / -400 keep 4.5:1.
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0.5 right-1 text-[8px] font-medium uppercase leading-none text-slate-500 dark:text-slate-400"
          >
            {o.shortcut}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );

  const divider = (key: string) => (
    <span
      key={key}
      aria-hidden
      className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
    />
  );

  const penItems = prefs.pens.map((pen) => {
    const inHand = tool === 'pen' && prefs.activePenId === pen.id;
    return (
      <Fragment key={pen.id}>
        {item({
          key: pen.id,
          label: penLabel(pen),
          shortcut: WHITEBOARD_TOOL_KEYS[pen.id],
          icon: <PenGlyph colour={pen.colour ?? ink} width={pen.width} />,
          pressed: inHand,
          flyoutKind: pen.id,
          onPress: (el) =>
            inHand ? toggleFlyout(pen.id, el) : pickAndClose(() => model.pickPen(pen.id)),
        })}
      </Fragment>
    );
  });

  function pickAndClose(pick: () => void) {
    setFlyout(null);
    pick();
  }

  const flyoutBody = (kind: Flyout['kind']): { label: string; body: ReactNode } => {
    if (kind === 'eraser') {
      return {
        label: 'Eraser',
        body: (
          <div className="flex flex-col gap-1">
            {ERASER_MODES.map((m) => (
              <FlyoutOption
                key={m.id}
                wide
                label={`${m.label}: ${m.hint}`}
                selected={prefs.eraserMode === m.id}
                onPick={() => model.setEraserMode(m.id)}
              >
                <span className="flex w-full flex-col items-start text-left leading-tight">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{m.hint}</span>
                </span>
              </FlyoutOption>
            ))}
          </div>
        ),
      };
    }
    if (kind === 'shapes') {
      return {
        label: 'Shapes',
        body: (
          <div className="grid grid-cols-3 gap-1">
            {WHITEBOARD_SHAPES.map((s) => (
              <FlyoutOption
                key={s.id}
                label={s.label}
                selected={false}
                onPick={() => pickAndClose(() => model.pickShape(s.id))}
              >
                <ShapeGlyph id={s.id} />
              </FlyoutOption>
            ))}
          </div>
        ),
      };
    }
    if (kind === 'more') {
      const current = whiteboardBackgroundOf(model.background);
      return {
        label: 'Background',
        body: (
          <FlyoutRow label="">
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
        ),
      };
    }
    const pen = prefs.pens.find((p) => p.id === kind)!;
    return {
      // Named by its place, so "which pen am I editing" never changes under the pointer.
      label: PEN_NAMES[pen.id],
      body: (
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
      ),
    };
  };

  const open = flyout ? flyoutBody(flyout.kind) : null;

  return (
    <div
      data-floating-panel=""
      data-whiteboard-dock=""
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      // Centred, and lifted above the bottom-right cluster (history, layers,
      // zoom) until the viewport is wide enough for the two side by side (D9).
      className="pointer-events-none absolute bottom-[4.25rem] left-1/2 z-[var(--z-toolbar)] w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 min-[1500px]:bottom-4"
    >
      {flyout && open ? (
        <WhiteboardFlyout
          key={flyout.kind}
          id={`whiteboard-flyout-${flyout.kind}`}
          label={open.label}
          left={flyout.left}
          onClose={closeFlyout}
        >
          {open.body}
        </WhiteboardFlyout>
      ) : null}
      <div
        role="toolbar"
        aria-label="Whiteboard tools"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="pointer-events-auto flex animate-pop-in items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 [scrollbar-width:none] dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      >
        {item({
          key: 'select',
          label: 'Select',
          shortcut: WHITEBOARD_TOOL_KEYS.select,
          icon: <SelectIcon size={DOCK_ICON_PX} />,
          pressed: tool === 'select',
          onPress: () => pickAndClose(model.pickSelect),
        })}
        {divider('d1')}
        {penItems}
        {divider('d2')}
        {item({
          key: 'eraser',
          label: 'Eraser',
          shortcut: WHITEBOARD_TOOL_KEYS.eraser,
          icon: <EraserIcon size={DOCK_ICON_PX} />,
          pressed: tool === 'eraser',
          flyoutKind: 'eraser',
          onPress: (el) =>
            tool === 'eraser' ? toggleFlyout('eraser', el) : pickAndClose(model.pickEraser),
        })}
        {divider('d3')}
        {item({
          key: 'sticky',
          label: 'Sticky note',
          icon: <StickyGlyph />,
          pressed: tool === 'sticky',
          onPress: () => pickAndClose(model.pickSticky),
        })}
        {item({
          key: 'text',
          label: 'Text',
          icon: <TextGlyph />,
          pressed: tool === 'text',
          onPress: () => pickAndClose(model.pickText),
        })}
        {item({
          key: 'shapes',
          label: 'Shapes',
          icon: <ShapesGlyph />,
          pressed: tool === 'shape',
          flyoutKind: 'shapes',
          onPress: (el) => toggleFlyout('shapes', el),
        })}
        {divider('d4')}
        {item({
          key: 'recognise',
          label: 'Shape recognition',
          icon: <RecogniseGlyph />,
          pressed: prefs.recognise,
          onPress: () => model.toggleRecognition(),
        })}
        {divider('d5')}
        {item({
          key: 'undo',
          label: 'Undo',
          icon: <UndoGlyph />,
          disabled: !canUndo,
          onPress: onUndo,
        })}
        {item({
          key: 'redo',
          label: 'Redo',
          icon: <RedoGlyph />,
          disabled: !canRedo,
          onPress: onRedo,
        })}
        {divider('d6')}
        {item({
          key: 'more',
          label: 'More',
          icon: <MoreGlyph />,
          flyoutKind: 'more',
          onPress: (el) => toggleFlyout('more', el),
        })}
      </div>
    </div>
  );
}

function FlyoutRows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

function FlyoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      {label ? (
        <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      ) : null}
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
