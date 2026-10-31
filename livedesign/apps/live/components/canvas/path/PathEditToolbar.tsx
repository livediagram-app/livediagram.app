'use client';

import type { ReactElement } from 'react';
import { Tooltip } from '@livedesign/ui';
import type { PathHandleMode } from '@livedesign/design';
import { FloatingToolbar } from '@/components/chrome/FloatingToolbar';

export type PathToolbarView = {
  // Where it floats: above the path's box, or above the long-pressed node (a point).
  bounds: { x: number; y: number; width: number; height: number };
  // The type every selected node shares, or null.
  type: PathHandleMode | null;
  hasSelection: boolean;
  closed: boolean;
  // Open path cuts at one selected node.
  canOpen: boolean;
  // Close Path / Open Path is offered (not for a combined path, whose contours share `closed`).
  canClose?: boolean;
  // A combined path's contour being edited, of how many (null for a plain path).
  shape?: { index: number; count: number } | null;
  // Simplify is offered: the contour is a long run of plain corners (lib/path-simplify).
  canSimplify?: boolean;
};

const NODE_TYPES: { id: PathHandleMode; label: string }[] = [
  { id: 'corner', label: 'Corner' },
  { id: 'mirrored', label: 'Mirrored' },
  { id: 'aligned', label: 'Aligned' },
];

const BUTTON =
  'flex h-8 items-center justify-center whitespace-nowrap rounded-md px-2 max-sm:px-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white';
const CHECKED =
  'bg-brand-50 text-brand-700 ring-2 ring-inset ring-brand-500 dark:bg-brand-500/15 dark:text-brand-200';

// A path's edit toolbar (docs/specs/023-draw-mode/path-tool.md "Editing"; blueprint path-tool "Edit
// mode"): everything edit mode does by key, as buttons, so a finger reaches it too. It floats in
// the canvas's transformed layer like the selection toolbar, counter-scaled to a constant size;
// `data-canvas-toolbar` keeps its presses away from the edit gesture.
export function PathEditToolbar({
  view,
  viewportOffset,
  zoom,
  onSetType,
  onDelete,
  onToggleClosed,
  onNextShape,
  onSimplify,
  onDone,
}: {
  view: PathToolbarView;
  viewportOffset: { x: number; y: number };
  zoom: number;
  onSetType: (type: PathHandleMode) => void;
  onDelete: () => void;
  onToggleClosed: () => void;
  onNextShape?: () => void;
  onSimplify?: () => void;
  onDone: () => void;
}) {
  const shape = view.shape ?? null;
  return (
    <div
      data-canvas-toolbar=""
      data-path-edit-toolbar=""
      className="pointer-events-none absolute inset-0 z-[var(--z-overlay)] origin-center"
      style={{
        transform: `scale(${zoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
      }}
    >
      <FloatingToolbar
        bounds={view.bounds}
        canvasOffset={viewportOffset}
        zoom={zoom}
        title="Edit path"
      >
        {/* On a phone the buttons wrap onto a second row rather than run off the screen. */}
        <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-0.5">
          {shape && onNextShape ? (
            <>
              {/* A combined path edits one contour at a time; this steps to the next. */}
              <Tip label="Edit the Next Shape">
                <button
                  type="button"
                  data-path-shape=""
                  aria-label={`Shape ${shape.index + 1} of ${shape.count}, edit the next shape`}
                  onClick={onNextShape}
                  className={`${BUTTON} tabular-nums`}
                >
                  {/* A phone has room for the count alone. */}
                  <span aria-hidden className="sm:hidden">
                    {shape.index + 1}/{shape.count}
                  </span>
                  <span aria-hidden className="max-sm:hidden">
                    Shape {shape.index + 1} of {shape.count}
                  </span>
                </button>
              </Tip>
              <Divider />
            </>
          ) : null}
          <div role="radiogroup" aria-label="Node type" className="flex items-center gap-0.5">
            {NODE_TYPES.map((t) => (
              <Tip key={t.id} label={`${t.label} point`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={view.type === t.id}
                  disabled={!view.hasSelection}
                  onClick={() => onSetType(t.id)}
                  className={`${BUTTON} ${view.type === t.id ? CHECKED : ''}`}
                >
                  {t.label}
                </button>
              </Tip>
            ))}
          </div>
          <Divider />
          <Tip label="Delete Point">
            <button
              type="button"
              aria-keyshortcuts="Delete"
              disabled={!view.hasSelection}
              onClick={onDelete}
              className={BUTTON}
            >
              Delete Point
            </button>
          </Tip>
          {view.canSimplify && onSimplify ? (
            <Tip label="Simplify: Fewer Points, Smooth Curves">
              <button type="button" onClick={onSimplify} className={BUTTON}>
                Simplify
              </button>
            </Tip>
          ) : null}
          {view.canClose === false ? null : (
            <Tip label={view.closed ? 'Open Path' : 'Close Path'}>
              <button
                type="button"
                aria-keyshortcuts={view.closed ? undefined : 'J'}
                disabled={view.closed && !view.canOpen}
                onClick={onToggleClosed}
                className={BUTTON}
              >
                {view.closed ? 'Open Path' : 'Close Path'}
              </button>
            </Tip>
          )}
          <Divider />
          <Tip label="Done">
            <button type="button" aria-keyshortcuts="Escape" onClick={onDone} className={BUTTON}>
              Done
            </button>
          </Tip>
        </div>
      </FloatingToolbar>
    </div>
  );
}

function Tip({ label, children }: { label: string; children: ReactElement }) {
  return <Tooltip label={label}>{children}</Tooltip>;
}

function Divider() {
  // A row that wraps on a phone needs no rule between groups.
  return (
    <span
      aria-hidden
      className="mx-0.5 h-5 w-px shrink-0 bg-slate-200 max-sm:hidden dark:bg-slate-700"
    />
  );
}
