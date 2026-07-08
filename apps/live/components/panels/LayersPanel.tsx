'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { isLayerLocked, isLayerVisible, type Element, type Layer } from '@livediagram/diagram';
import { useLayerThumbnails } from '@/hooks/ui/useLayerThumbnails';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { LayerRowMenu } from '@/components/panels/LayerRowMenu';
import { LayersSettingsPopover } from '@/components/panels/LayersSettingsPopover';
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
  onMergeLayer,
  onSetLayerOpacity,
  onClearLayer,
  onHideOtherLayers,
  onPreviewLayer,
  hoverPreviewEnabled,
  onSetHoverPreviewEnabled,
  resettable,
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
  // Merge the ACTIVE layer into its neighbour; the neighbour survives.
  onMergeLayer: (direction: 'above' | 'below') => void;
  // Row context-menu verbs (spec/74). Opacity is a live slider (the hook
  // debounces its history step); clear + hide-others are one-shot.
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onClearLayer: (layerId: string) => void;
  onHideOtherLayers: (layerId: string) => void;
  // Hover-to-solo: while a row is hovered the canvas shows ONLY that
  // layer; null restores the normal view. Ephemeral, never persisted.
  onPreviewLayer: (layerId: string | null) => void;
  // The hover-solo user preference (spec/20) + its setter, surfaced in
  // the header gear alongside Reset position.
  hoverPreviewEnabled: boolean;
  onSetHoverPreviewEnabled: (value: boolean) => void;
  // True when the panel has left its default corner (enables Reset).
  resettable: boolean;
}) {
  // Inline rename: which layer id is being edited + its draft text.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  // Footer-delete confirm popover (only for a non-empty layer): the
  // clicked Delete button is the anchor; null = closed.
  const [confirmAnchor, setConfirmAnchor] = useState<HTMLElement | null>(null);
  // Row drag-to-restack, driven by POINTER events on the grip handle
  // (native HTML5 drag-and-drop is unreliable inside the panel and dead
  // on touch): the dragged layer id + the row currently under the
  // pointer (whose slot is the drop position).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Per-row layer previews — shared with the context menu's Move-to-layer
  // tiles via useLayerThumbnails.
  const { thumbMarkup, thumbViewBox } = useLayerThumbnails(elements, layers);

  // Row context menu (spec/74): which layer it targets + where to hang
  // it (the panel's left edge at the clicked row).
  const [rowMenu, setRowMenu] = useState<{
    layerId: string;
    panelLeft: number;
    rowBottom: number;
  } | null>(null);

  // Hover-to-solo, DEBOUNCED: the preview engages only after the pointer
  // rests on a row for a beat (instant solo flashing on every pass-over
  // read as jumpy). Once engaged, moving across rows switches instantly,
  // tooltip-chain style; leaving the list disengages.
  const previewTimerRef = useRef<number | null>(null);
  const previewActiveRef = useRef(false);
  const clearPreviewTimer = () => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };
  const enterRowPreview = (layerId: string) => {
    if (!hoverPreviewEnabled) return;
    clearPreviewTimer();
    if (previewActiveRef.current) {
      onPreviewLayer(layerId);
      return;
    }
    previewTimerRef.current = window.setTimeout(() => {
      previewActiveRef.current = true;
      onPreviewLayer(layerId);
    }, 1000);
  };
  const leaveRowPreview = () => {
    clearPreviewTimer();
    previewActiveRef.current = false;
    onPreviewLayer(null);
  };

  // The hover-solo preview must never outlive the panel (rows unmount
  // without firing pointerleave when it collapses).
  useEffect(
    () => () => {
      clearPreviewTimer();
      onPreviewLayer(null);
    },
    [onPreviewLayer],
  );

  // Top layer first, matching the paint stack top-down.
  const rows = [...layers].reverse();
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeCount = counts.get(activeLayerId) ?? 0;
  // Merge availability: needs a neighbour in that direction.
  const activeIndex = layers.findIndex((l) => l.id === activeLayerId);
  const canMergeUp = activeIndex >= 0 && activeIndex < layers.length - 1;
  const canMergeDown = activeIndex > 0;

  const commitRename = () => {
    if (renamingId) onRenameLayer(renamingId, draftName);
    setRenamingId(null);
  };

  // Open the row menu beside the panel — shared by right-click and the
  // row's ellipsis button. The menu's verbs act on the ACTIVE layer, so
  // opening activates the row first (Photoshop's rule).
  const openRowMenu = (layerId: string, rowEl: HTMLElement | null) => {
    onSelectLayer(layerId);
    const panel = listRef.current?.getBoundingClientRect();
    const row = rowEl?.closest('[data-layer-id]')?.getBoundingClientRect();
    if (panel && row) {
      setRowMenu({ layerId, panelLeft: panel.left, rowBottom: row.bottom });
    }
  };

  // Which row the pointer is over, by live geometry (rows carry their
  // layer id in a data attribute).
  const rowLayerIdAt = (clientY: number): string | null => {
    const list = listRef.current;
    if (!list) return null;
    for (const child of Array.from(list.children)) {
      const r = child.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return (child as HTMLElement).dataset.layerId ?? null;
      }
    }
    return null;
  };

  // Drag-to-restack starts from ANYWHERE on a row (the grip stays as
  // the visual affordance): pointerdown records the press, and the drag
  // only engages once the pointer travels a few px — so plain clicks
  // (activate) and double-clicks (rename) still work. Presses on the
  // row's buttons / rename input keep their own gestures. Pointer
  // capture on the row keeps move / up flowing during the drag.
  const pressRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const rowPointerDown = (layerId: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || renamingId === layerId) return;
    if (e.target instanceof HTMLElement && e.target.closest('button, input')) return;
    pressRef.current = { id: layerId, x: e.clientX, y: e.clientY };
  };
  const rowPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (press && !dragId) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4) {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragId(press.id);
      }
      return;
    }
    if (dragId) {
      const over = rowLayerIdAt(e.clientY);
      setDropTargetId(over && over !== dragId ? over : null);
    }
  };
  const rowPointerUp = () => {
    pressRef.current = null;
    if (!dragId) return;
    if (dropTargetId) {
      // Dropping ON a row means "take that row's slot": convert the
      // target's position back to the bottom->top data index.
      const toIndex = layers.findIndex((l) => l.id === dropTargetId);
      if (toIndex >= 0) onReorderLayer(dragId, toIndex);
    }
    setDragId(null);
    setDropTargetId(null);
  };

  return (
    <MovablePanel
      title="Layers"
      position={position}
      defaultCorner="bottom-right"
      width="w-auto sm:w-64"
      onMoveTo={onMoveTo}
      {...dock}
      onMinimize={onMinimize}
      headerActions={
        <LayersSettingsPopover
          hoverPreview={hoverPreviewEnabled}
          onSetHoverPreview={onSetHoverPreviewEnabled}
          onResetPosition={() => onReset?.()}
          resettable={resettable}
        />
      }
      mobileOpenOverride={mobileOpenOverride}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
      onMobileClose={onMobileClose}
    >
      <div className="px-2 pb-2">
        <ul ref={listRef} className="flex flex-col gap-0.5">
          {rows.map((layer) => {
            const active = layer.id === activeLayerId;
            const visible = isLayerVisible(layer);
            const locked = isLayerLocked(layer);
            const empty = (counts.get(layer.id) ?? 0) === 0;
            return (
              <li
                key={layer.id}
                data-layer-id={layer.id}
                onPointerEnter={() => enterRowPreview(layer.id)}
                onPointerLeave={leaveRowPreview}
                onPointerDown={rowPointerDown(layer.id)}
                onPointerMove={rowPointerMove}
                onPointerUp={rowPointerUp}
                onPointerCancel={rowPointerUp}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openRowMenu(layer.id, e.currentTarget);
                }}
                className={
                  'group flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition ' +
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
                <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
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
                {/* Empty layers wear a quiet tag so they're easy to spot
                    (and prune) at a glance — the blank preview alone
                    doesn't read as "nothing here". */}
                {empty && renamingId !== layer.id ? (
                  <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    Empty
                  </span>
                ) : null}
                {locked ? (
                  <span
                    aria-label={`${layer.name} is locked`}
                    className="shrink-0 text-brand-600 dark:text-brand-400"
                  >
                    <LockIcon />
                  </span>
                ) : null}
                <Tooltip
                  title="Layer options"
                  description="Rename, restack, lock, merge, and more."
                >
                  <button
                    type="button"
                    aria-label={`${layer.name} options`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRowMenu(layer.id, e.currentTarget);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  >
                    <EllipsisIcon />
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-1.5">
          <div className="flex gap-1.5">
            <Tooltip
              title="Merge Up"
              description={
                canMergeUp
                  ? 'Fold the active layer into the one above it.'
                  : 'No layer above to merge into.'
              }
            >
              <button
                type="button"
                disabled={!canMergeUp}
                aria-label="Merge with the layer above"
                onClick={() => onMergeLayer('above')}
                className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-900"
              >
                <MergeUpIcon />
              </button>
            </Tooltip>
            <Tooltip
              title="Merge Down"
              description={
                canMergeDown
                  ? 'Fold the active layer into the one below it.'
                  : 'No layer below to merge into.'
              }
            >
              <button
                type="button"
                disabled={!canMergeDown}
                aria-label="Merge with the layer below"
                onClick={() => onMergeLayer('below')}
                className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-900"
              >
                <MergeDownIcon />
              </button>
            </Tooltip>
          </div>
          <div className="flex gap-1.5">
            <Tooltip title="Add Layer" description="Insert a new layer above the active one.">
              <button
                type="button"
                onClick={onAddLayer}
                className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <PlusIcon />
                Add
              </button>
            </Tooltip>
            <Tooltip
              title="Delete Layer"
              description={
                layers.length <= 1
                  ? 'The last layer can’t be deleted.'
                  : 'Delete the active layer and everything on it.'
              }
            >
              <button
                type="button"
                disabled={layers.length <= 1}
                aria-label="Delete Layer"
                onClick={(e) => {
                  // Empty layers delete straight away; a populated one
                  // asks first via an anchored popover (spec/74).
                  if (activeCount === 0) onRemoveLayer(activeLayerId);
                  else setConfirmAnchor(e.currentTarget);
                }}
                className="flex items-center justify-center rounded-md border border-red-200 bg-white px-2 py-1 text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white dark:border-red-500/40 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10 dark:disabled:border-slate-700 dark:disabled:text-slate-600 dark:disabled:hover:bg-slate-900"
              >
                <TrashIcon />
              </button>
            </Tooltip>
          </div>
        </div>
        {rowMenu
          ? (() => {
              const menuLayer = layers.find((l) => l.id === rowMenu.layerId);
              if (!menuLayer) return null;
              const idx = layers.findIndex((l) => l.id === menuLayer.id);
              return (
                <LayerRowMenu
                  layer={menuLayer}
                  elementCount={counts.get(menuLayer.id) ?? 0}
                  isTop={idx === layers.length - 1}
                  isBottom={idx === 0}
                  anchor={{ panelLeft: rowMenu.panelLeft, rowBottom: rowMenu.rowBottom }}
                  onClose={() => setRowMenu(null)}
                  onRename={() => {
                    setRenamingId(menuLayer.id);
                    setDraftName(menuLayer.name);
                  }}
                  canDelete={layers.length > 1}
                  onDelete={() => onRemoveLayer(menuLayer.id)}
                  onSetOpacity={(v) => onSetLayerOpacity(menuLayer.id, v)}
                  onBringToTop={() => onReorderLayer(menuLayer.id, layers.length - 1)}
                  onSendToBottom={() => onReorderLayer(menuLayer.id, 0)}
                  onHideOthers={() => onHideOtherLayers(menuLayer.id)}
                  onToggleLock={() => onToggleLock(menuLayer.id)}
                  onClear={() => onClearLayer(menuLayer.id)}
                  onMergeUp={() => onMergeLayer('above')}
                  onMergeDown={() => onMergeLayer('below')}
                />
              );
            })()
          : null}
        {confirmAnchor && activeLayer ? (
          <ConfirmPopover
            anchor={confirmAnchor}
            message={`Delete “${activeLayer.name}” and its ${activeCount} ${
              activeCount === 1 ? 'element' : 'elements'
            }?`}
            confirmLabel="Delete"
            onConfirm={() => {
              setConfirmAnchor(null);
              onRemoveLayer(activeLayerId);
            }}
            onCancel={() => setConfirmAnchor(null)}
          />
        ) : null}
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

function EllipsisIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="3" cy="7" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <circle cx="11" cy="7" r="1.2" />
    </svg>
  );
}

function MergeUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 2.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M7 11.5V6M4.5 8.5 7 6l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MergeDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 11.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M7 2.5V8M4.5 5.5 7 8l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
