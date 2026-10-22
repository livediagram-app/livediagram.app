'use client';

import { useRef, useState } from 'react';
import { type Element, type Layer } from '@livepages/document';
import { useLayerThumbnails } from '@/hooks/ui/useLayerThumbnails';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { LayerRow } from '@/components/panels/LayerRow';
import { LayerRowMenu } from '@/components/panels/LayerRowMenu';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { useLayerRowDrag } from '@/components/panels/useLayerRowDrag';
import { useRevertOnUnmount } from '@/components/primitives/hover-preview';
import {
  FooterDeleteIcon,
  MergeDownIcon,
  MergeUpIcon,
  PlusIcon,
} from '@/components/panels/layers-panel-icons';
import type { MovablePanelPopoverProps } from '@/components/primitives/MovablePanel.types';
import { HoverCard, SOLID_BRAND_DARK_CONTROL } from '@livepages/ui';

// Under a lone layer, so a first visit learns what the panel is for.
export const SINGLE_LAYER_HINT =
  'Layers keep a background, content and notes apart. Add one to stack on top.';

// The popover never moves, so its MovablePanel's move handler has nothing to do.
const NO_MOVE = () => {};

// The Layers panel (docs/specs/006-document/layers.md "The Layers panel"): a header bar (layer
// count + New Layer), one roomy row per layer, TOP layer first (the panel mirrors the paint stack
// like every design tool; see LayerRow), and a footer acting on the ACTIVE layer (Merge Up / Merge
// Down / Delete, with an anchored confirm when it still has elements; the last layer can't be
// deleted). Rows drag to restack. Pure view: every mutation is a callback into useLayersState.

// Shared look of the footer's labelled buttons.
const FOOTER_BUTTON =
  'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent';

export function LayersPanel({
  layers,
  tabFont,
  activeLayerId,
  counts,
  elements,
  popoverOpen,
  popoverAnchor,
  onPopoverClose,
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
  showPreview,
  showCount,
}: {
  // Normalised layers, BOTTOM -> TOP (the data order); rendered reversed.
  layers: Layer[];
  activeLayerId: string;
  counts: Map<string, number>;
  // The tab's elements, for the per-row layer previews.
  elements: Element[];
  // The tab default face (docs/specs/004-interface-design/fonts.md), so a preview matches the canvas.
  tabFont?: string;
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
  // Row context-menu verbs (docs/specs/006-document/layers.md). Opacity is a live slider (the hook
  // debounces its history step); clear + hide-others are one-shot.
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  onClearLayer: (layerId: string) => void;
  onHideOtherLayers: (layerId: string) => void;
  // Hover-to-solo: while a row is hovered the canvas shows ONLY that
  // layer; null restores the normal view. Ephemeral, never persisted.
  onPreviewLayer: (layerId: string | null) => void;
  // The hover-solo user preference (docs/specs/007-editor/user-preferences.md) + its setter, surfaced in
  // the header gear alongside Reset position.
  hoverPreviewEnabled: boolean;
  // Row density (docs/specs/006-document/layers.md): the thumbnail and the element count are each
  // optional, so a document with many layers reads as a compact list.
  showPreview: boolean;
  showCount: boolean;
} & Pick<MovablePanelPopoverProps, 'popoverOpen' | 'popoverAnchor' | 'onPopoverClose'>) {
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
  const { thumbMarkup, thumbViewBox } = useLayerThumbnails(elements, layers, tabFont);

  // Row context menu (docs/specs/006-document/layers.md): which layer it targets + where to hang
  // it (the panel's left edge at the clicked row).
  const [rowMenu, setRowMenu] = useState<{
    layerId: string;
    panelLeft: number;
    rowBottom: number;
  } | null>(null);

  // Hover-to-solo, DEBOUNCED: the preview engages only after the pointer
  // rests on a row for a beat (instant solo flashing on every pass-over
  // read as jumpy). Once engaged, moving across rows switches instantly,
  // like the tooltip warm-up; leaving the list disengages.
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
  const { dragId, dropTargetId, dropEdge, rowPointerDown, rowPointerMove, rowPointerUp } =
    useLayerRowDrag({
      listRef,
      layers,
      renamingId,
      onReorderLayer,
    });

  return (
    <MovablePanel
      helpArticle="layers"
      title="Layers"
      // A popover over its bottom-right cluster button (docs/specs/006-document/layers.md): never placed or dragged.
      position={null}
      defaultCorner="bottom-right"
      width="w-auto sm:w-80"
      // Roomy rows (docs/specs/006-document/layers.md "The Layers panel"): the default 16rem crushed the
      // name between the preview and the row controls.
      popoverWidth="w-[22rem]"
      onMoveTo={NO_MOVE}
      popoverOpen={popoverOpen}
      popoverAnchor={popoverAnchor}
      asPopover
      dismissOnOutside
      onPopoverClose={onPopoverClose}
    >
      <div className="pb-1">
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {layers.length} {layers.length === 1 ? 'layer' : 'layers'}
          </span>
          <HoverCard title="New Layer" description="Add a layer above the active one.">
            <button
              type="button"
              onClick={onAddLayer}
              className={`flex h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
            >
              <PlusIcon />
              New Layer
            </button>
          </HoverCard>
        </div>
        <ul
          ref={listRef}
          className="flex max-h-[min(60vh,28rem)] flex-col gap-1 overflow-y-auto px-2 py-0.5"
        >
          {rows.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              activeLayerId={activeLayerId}
              counts={counts}
              showPreview={showPreview}
              showCount={showCount}
              thumbViewBox={thumbViewBox}
              thumbMarkup={thumbMarkup}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
              commitRename={commitRename}
              dragId={dragId}
              dropTargetId={dropTargetId}
              dropEdge={dropEdge}
              enterRowPreview={enterRowPreview}
              leaveRowPreview={leaveRowPreview}
              rowPointerDown={rowPointerDown}
              rowPointerMove={rowPointerMove}
              rowPointerUp={rowPointerUp}
              openRowMenu={openRowMenu}
              onSelectLayer={onSelectLayer}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
            />
          ))}
        </ul>
        {layers.length === 1 ? (
          <p className="px-3 pb-1 pt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {SINGLE_LAYER_HINT}
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-100 px-2 pt-1.5 dark:border-slate-800">
          <div className="flex gap-0.5">
            <HoverCard
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
                className={FOOTER_BUTTON}
              >
                <MergeUpIcon />
                Merge Up
              </button>
            </HoverCard>
            <HoverCard
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
                className={FOOTER_BUTTON}
              >
                <MergeDownIcon />
                Merge Down
              </button>
            </HoverCard>
          </div>
          <HoverCard
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
                // asks first via an anchored popover (docs/specs/006-document/layers.md).
                if (activeCount === 0) onRemoveLayer(activeLayerId);
                else setConfirmAnchor(e.currentTarget);
              }}
              className={FOOTER_BUTTON}
            >
              <FooterDeleteIcon />
              Delete
            </button>
          </HoverCard>
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
                  thumbViewBox={thumbViewBox}
                  thumbMarkup={thumbMarkup.get(menuLayer.id)}
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
                  onToggleVisibility={() => onToggleVisibility(menuLayer.id)}
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
