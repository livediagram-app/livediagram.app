'use client';

import { useMemo, useState, type DragEvent } from 'react';
import {
  contentBounds,
  isBoxed,
  isLayerLocked,
  isLayerVisible,
  orderByLayer,
  r2,
  resolveLayerId,
  svgArrow,
  svgBoxed,
  type Element,
  type Layer,
} from '@livediagram/diagram';
import { resolveIconArtLoaded } from '@/lib/icon-registry';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel.types';
import { Tooltip } from '@/components/primitives/Tooltip';

// The Layers panel (spec/74): one row per layer, TOP layer first (the
// panel mirrors the paint stack like every design tool). Row = eye
// toggle · a mini preview of just that layer's elements (all rows share
// the whole tab's framing so content reads in place, like the Map) ·
// name (double-click to rename inline) · element count · lock toggle,
// with the whole row click setting the ACTIVE layer. Rows drag
// to restack; the footer adds a layer above the active one or deletes
// the active layer (inline confirm when it still has elements; the
// last layer can't be deleted). Pure view: every mutation is a
// callback into useLayersState.

export function LayersPanel({
  layers,
  activeLayerId,
  counts,
  elements,
  position,
  onMoveTo,
  onReset,
  dock,
  onMinimize,
  mobileOpenOverride,
  mobileDockAnchor,
  forceDockMode,
  onMobileClose,
  onSelectLayer,
  onAddLayer,
  onRemoveLayer,
  onRenameLayer,
  onToggleVisibility,
  onToggleLock,
  onReorderLayer,
}: {
  // Normalised layers, BOTTOM -> TOP (the data order); rendered reversed.
  layers: Layer[];
  activeLayerId: string;
  counts: Map<string, number>;
  // The tab's elements, for the per-row layer previews.
  elements: Element[];
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  dock?: MovablePanelDockProps;
  onMinimize: () => void;
  mobileOpenOverride?: boolean;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
  onMobileClose?: () => void;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onRemoveLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  // `toIndex` is in the bottom->top DATA order (the hook's contract);
  // the drag handler converts from the reversed row order.
  onReorderLayer: (layerId: string, toIndex: number) => void;
}) {
  // Inline rename: which layer id is being edited + its draft text.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  // Footer-delete inline confirm (only shown for a non-empty layer).
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Row drag-to-restack: the dragged layer id + the row currently
  // hovered as the drop target (for the insertion highlight).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Per-row layer previews: the SAME headless renderer the Map / exports
  // use, split into one markup string per layer. Every row shares the
  // whole tab's content bounds as its viewBox, so each preview shows its
  // layer's elements where they actually sit. Hidden layers keep their
  // preview (that's how you see what you're missing). Rebuilt only when
  // the elements / stack change; the markup is our own renderer's output
  // (user text xmlEscaped inside it), so injecting it is safe.
  const iconsLoaded = useIconCatalogs();
  const { thumbMarkup, thumbViewBox } = useMemo(() => {
    if (elements.length === 0) {
      return { thumbMarkup: new Map<string, string>(), thumbViewBox: null };
    }
    const boxedParts = new Map<string, string[]>(layers.map((l) => [l.id, []]));
    const arrowParts = new Map<string, string[]>(layers.map((l) => [l.id, []]));
    for (const el of orderByLayer(elements, layers, { includeHidden: true })) {
      const lid = resolveLayerId(el.layerId, layers);
      if (el.type === 'arrow') arrowParts.get(lid)?.push(svgArrow(el, elements));
      else if (isBoxed(el))
        boxedParts.get(lid)?.push(svgBoxed(el, undefined, resolveIconArtLoaded));
    }
    const markup = new Map(
      layers.map((l) => [l.id, boxedParts.get(l.id)!.join('') + arrowParts.get(l.id)!.join('')]),
    );
    const b = contentBounds(elements);
    const pad = 8;
    return {
      thumbMarkup: markup,
      thumbViewBox: `${r2(b.x - pad)} ${r2(b.y - pad)} ${r2(b.w + pad * 2)} ${r2(b.h + pad * 2)}`,
    };
    // iconsLoaded re-runs the build when the catalogue chunk lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, layers, iconsLoaded]);

  // Top layer first, matching the paint stack top-down.
  const rows = [...layers].reverse();
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeCount = counts.get(activeLayerId) ?? 0;

  const commitRename = () => {
    if (renamingId) onRenameLayer(renamingId, draftName);
    setRenamingId(null);
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const source = dragId;
    setDragId(null);
    setDropTargetId(null);
    if (!source || source === targetId) return;
    // Dropping ON a row means "take that row's slot": convert the
    // target's position back to the bottom->top data index.
    const toIndex = layers.findIndex((l) => l.id === targetId);
    if (toIndex >= 0) onReorderLayer(source, toIndex);
  };

  return (
    <MovablePanel
      title="Layers"
      position={position}
      defaultCorner="bottom-right"
      width="w-auto sm:w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      {...dock}
      onMinimize={onMinimize}
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
    >
      <div className="px-2 pb-2">
        <ul className="flex flex-col gap-0.5">
          {rows.map((layer) => {
            const active = layer.id === activeLayerId;
            const visible = isLayerVisible(layer);
            const locked = isLayerLocked(layer);
            const count = counts.get(layer.id) ?? 0;
            return (
              <li
                key={layer.id}
                draggable={renamingId !== layer.id}
                onDragStart={(e) => {
                  setDragId(layer.id);
                  e.dataTransfer.effectAllowed = 'move';
                  // Some browsers need data set for the drag to start.
                  e.dataTransfer.setData('text/plain', layer.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === layer.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTargetId(layer.id);
                }}
                onDragLeave={() => {
                  if (dropTargetId === layer.id) setDropTargetId(null);
                }}
                onDrop={(e) => handleDrop(e, layer.id)}
                className={
                  'group flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 transition ' +
                  (active
                    ? 'bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30 '
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 ') +
                  (dropTargetId === layer.id ? 'outline outline-2 outline-brand-400 ' : '') +
                  (dragId === layer.id ? 'opacity-50 ' : '')
                }
                onClick={() => onSelectLayer(layer.id)}
                onDoubleClick={() => {
                  setRenamingId(layer.id);
                  setDraftName(layer.name);
                }}
              >
                <Tooltip
                  title={visible ? 'Hide layer' : 'Show layer'}
                  description={
                    visible
                      ? 'Hide every element on this layer.'
                      : 'Show this layer’s elements again.'
                  }
                >
                  <button
                    type="button"
                    aria-label={visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    aria-pressed={!visible}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id);
                    }}
                    className={
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-slate-200 dark:hover:bg-slate-700 ' +
                      (visible
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-300 dark:text-slate-600')
                    }
                  >
                    {visible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </Tooltip>
                <span className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                  {thumbViewBox && thumbMarkup.get(layer.id) ? (
                    <svg
                      viewBox={thumbViewBox}
                      preserveAspectRatio="xMidYMid meet"
                      className="h-full w-full"
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: thumbMarkup.get(layer.id)! }}
                    />
                  ) : null}
                </span>
                {renamingId === layer.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Layer name"
                    className="w-full min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 outline-none dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <span
                    className={
                      'min-w-0 flex-1 truncate text-xs ' +
                      (active
                        ? 'font-semibold text-brand-700 dark:text-brand-300'
                        : 'font-medium text-slate-700 dark:text-slate-200')
                    }
                  >
                    {layer.name}
                  </span>
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                  {count}
                </span>
                <Tooltip
                  title={locked ? 'Unlock layer' : 'Lock layer'}
                  description={
                    locked
                      ? 'Make this layer’s elements editable again.'
                      : 'Protect every element on this layer from edits.'
                  }
                >
                  <button
                    type="button"
                    aria-label={locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    aria-pressed={locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(layer.id);
                    }}
                    className={
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-slate-200 dark:hover:bg-slate-700 ' +
                      (locked
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 dark:text-slate-600 ' +
                          (mobileOpenOverride || forceDockMode ? 'opacity-100 ' : ''))
                    }
                  >
                    {locked ? <LockIcon /> : <UnlockIcon />}
                  </button>
                </Tooltip>
                <span
                  aria-hidden
                  className="shrink-0 cursor-grab text-slate-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing dark:text-slate-600"
                >
                  <GripIcon />
                </span>
              </li>
            );
          })}
        </ul>
        {confirmingDelete && activeLayer ? (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <p className="mb-1.5">
              Delete “{activeLayer.name}” and its {activeCount}{' '}
              {activeCount === 1 ? 'element' : 'elements'}?
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onRemoveLayer(activeLayerId);
                }}
                className="flex-1 rounded-md bg-red-600 px-2 py-1 font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex gap-1.5">
            <Tooltip title="Add layer" description="Insert a new layer above the active one.">
              <button
                type="button"
                onClick={onAddLayer}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <PlusIcon />
                Add layer
              </button>
            </Tooltip>
            <Tooltip
              title="Delete layer"
              description={
                layers.length <= 1
                  ? 'The last layer can’t be deleted.'
                  : 'Delete the active layer and everything on it.'
              }
            >
              <button
                type="button"
                disabled={layers.length <= 1}
                aria-label="Delete layer"
                onClick={() => {
                  // Empty layers delete straight away; a populated one
                  // asks first (spec/74).
                  if (activeCount === 0) onRemoveLayer(activeLayerId);
                  else setConfirmingDelete(true);
                }}
                className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-900"
              >
                <TrashIcon />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </MovablePanel>
  );
}

// The dock-button glyph, exported so the CanvasChrome bottom-right
// cluster (minimised state) and the mobile dock share it.
export function LayersStackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 2 12 4.6 7 7.2 2 4.6 7 2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M2 7.3l5 2.6 5-2.6M2 9.9l5 2.6 5-2.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.5 7S3.5 3.5 7 3.5 12.5 7 12.5 7 10.5 10.5 7 10.5 1.5 7 1.5 7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.5 7S3.5 3.5 7 3.5c.8 0 1.5.18 2.2.46M12.5 7S10.5 10.5 7 10.5c-.8 0-1.5-.18-2.2-.46"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 11.5l9-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="6" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="6" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 4.9-.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2" r="1" />
      <circle cx="5.5" cy="2" r="1" />
      <circle cx="2.5" cy="6" r="1" />
      <circle cx="5.5" cy="6" r="1" />
      <circle cx="2.5" cy="10" r="1" />
      <circle cx="5.5" cy="10" r="1" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 4h9M5.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1m2 0-.5 7a1 1 0 0 1-1 .93h-4a1 1 0 0 1-1-.93L3.5 4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
