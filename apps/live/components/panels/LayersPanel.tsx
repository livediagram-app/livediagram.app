'use client';

import { useRef, useState } from 'react';
import { isLayerLocked, isLayerVisible, type Element, type Layer } from '@livediagram/diagram';
import { useLayerThumbnails } from '@/hooks/ui/useLayerThumbnails';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { LayerRowMenu } from '@/components/panels/LayerRowMenu';
import { LayersSettingsPopover } from '@/components/panels/LayersSettingsPopover';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useLayerRowDrag } from '@/components/panels/useLayerRowDrag';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MergeDownIcon,
  MergeUpIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/panels/layers-panel-icons';
import type { MovablePanelPlacementProps } from '@/components/primitives/MovablePanel.types';

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
  showPreview,
  onSetShowPreview,
  showCount,
  onSetShowCount,
  resettable,
}: {
  // Normalised layers, BOTTOM -> TOP (the data order); rendered reversed.
  layers: Layer[];
  activeLayerId: string;
  counts: Map<string, number>;
  // The tab's elements, for the per-row layer previews.
  elements: Element[];
  onMinimize: () => void;
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
  // Row density (spec/74): the thumbnail and the element count are each
  // optional, so a diagram with many layers reads as a compact list.
  showPreview: boolean;
  onSetShowPreview: (value: boolean) => void;
  showCount: boolean;
  onSetShowCount: (value: boolean) => void;
  // True when the panel has left its default corner (enables Reset).
  resettable: boolean;
} & MovablePanelPlacementProps) {
  // Inline rename: which layer id is being edited. The draft text lives
  // inside InlineRenameInput, so a re-render of this panel mid-rename
  // cannot reach in and reset what has been typed.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Footer-delete confirm popover (only for a non-empty layer): the
  // clicked Delete button is the anchor; null = closed.
  const [confirmAnchor, setConfirmAnchor] = useState<HTMLElement | null>(null);
  // Row drag-to-restack, driven by POINTER events on the grip handle
  // (native HTML5 drag-and-drop is unreliable inside the panel and dead
  // on touch): the dragged layer id + the row currently under the
  // pointer (whose slot is the drop position).
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
  // without firing pointerleave when it collapses). useRevertOnUnmount is the
  // shared primitive every other hover-preview surface uses for this; it holds
  // the callback in a latest-ref, so unlike the local effect this replaces it
  // reverts on unmount ONLY, not whenever onPreviewLayer changes identity.
  useRevertOnUnmount(() => {
    clearPreviewTimer();
    onPreviewLayer(null);
  });

  // Top layer first, matching the paint stack top-down.
  const rows = [...layers].reverse();
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeCount = counts.get(activeLayerId) ?? 0;
  // Merge availability: needs a neighbour in that direction.
  const activeIndex = layers.findIndex((l) => l.id === activeLayerId);
  const canMergeUp = activeIndex >= 0 && activeIndex < layers.length - 1;
  const canMergeDown = activeIndex > 0;

  const commitRename = (name: string) => {
    if (renamingId) onRenameLayer(renamingId, name);
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

  // Row drag-to-restack — see useLayerRowDrag.
  const { dragId, dropTargetId, rowPointerDown, rowPointerMove, rowPointerUp } = useLayerRowDrag({
    listRef,
    layers,
    renamingId,
    onReorderLayer,
  });

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
          showPreview={showPreview}
          onSetShowPreview={onSetShowPreview}
          showCount={showCount}
          onSetShowCount={onSetShowCount}
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
                onPointerEnter={onMouseHover(() => enterRowPreview(layer.id))}
                onPointerLeave={onMouseHover(leaveRowPreview)}
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
                onDoubleClick={() => setRenamingId(layer.id)}
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
                {showPreview ? (
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
                ) : null}
                {renamingId === layer.id ? (
                  <InlineRenameInput
                    initial={layer.name}
                    onCommit={commitRename}
                    onCancel={() => setRenamingId(null)}
                    ariaLabel="Layer name"
                    className="w-full min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
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
                {/* How much is on this layer. Same quiet chip as the Empty
                    tag below, so a column of rows reads as one thing. */}
                {showCount && !empty && renamingId !== layer.id ? (
                  <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    {counts.get(layer.id) ?? 0}
                  </span>
                ) : null}
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
                  onRename={() => setRenamingId(menuLayer.id)}
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
