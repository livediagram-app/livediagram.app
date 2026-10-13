'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { isLayerLocked, isLayerVisible, layerOpacityOf, type Layer } from '@livediagram/document';
import {
  BringToTopIcon,
  ClearIcon,
  DeleteIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MergeDownIcon,
  MergeUpIcon,
  RenameIcon,
  SendToBottomIcon,
  SoloIcon,
  UnlockIcon,
} from '@/components/panels/layers-panel-icons';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { MenuActionRow, MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import { MenuTreeContext, useClickOutside, useControlMenu, Portal } from '@livediagram/ui';

// The menu's width (w-64) and its gap from the panel and the viewport edges, in px.
const MENU_WIDTH = 256;
const MENU_GAP = 8;

// Where the menu sits: its right edge MENU_GAP left of the panel, its bottom on the clicked row's
// bottom (it grows up, since the panel lives in the bottom corner), both clamped so the whole menu
// stays on screen. Exported for its test.
export function layerMenuPosition(
  anchor: { panelLeft: number; rowBottom: number },
  menuHeight: number,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const left = Math.min(
    Math.max(MENU_GAP, anchor.panelLeft - MENU_GAP - MENU_WIDTH),
    viewport.width - MENU_WIDTH - MENU_GAP,
  );
  const top = Math.min(
    Math.max(MENU_GAP, anchor.rowBottom - menuHeight),
    viewport.height - menuHeight - MENU_GAP,
  );
  return { left, top: Math.max(MENU_GAP, top) };
}

// Right-click menu for a Layers-panel row (docs/specs/006-document/layers.md "Row context menu"):
// a header naming the layer, the opacity slider, then every verb as a plain row, grouped by
// separators. Nothing hides behind a category: the old accordion menu took two clicks to reach
// anything. Anchored to the LEFT of the panel so it never covers the rows it acts on. Destructive
// verbs (Delete on a populated layer, Clear) confirm via the shared ConfirmPopover before firing.
export function LayerRowMenu({
  layer,
  elementCount,
  thumbViewBox,
  thumbMarkup,
  isTop,
  isBottom,
  anchor,
  onClose,
  onRename,
  onDelete,
  canDelete,
  onSetOpacity,
  onBringToTop,
  onSendToBottom,
  onHideOthers,
  onToggleVisibility,
  onToggleLock,
  onClear,
  onMergeUp,
  onMergeDown,
}: {
  layer: Layer;
  elementCount: number;
  // The layer's preview, the same one its row shows; null markup draws an empty frame.
  thumbViewBox: string | null;
  thumbMarkup: string | undefined;
  isTop: boolean;
  isBottom: boolean;
  // Where to hang the menu: the panel's left edge + the clicked row's bottom, in viewport coords.
  anchor: { panelLeft: number; rowBottom: number };
  onClose: () => void;
  // Starts the row's inline rename back in the panel.
  onRename: () => void;
  onDelete: () => void;
  canDelete: boolean;
  onSetOpacity: (opacity: number) => void;
  onBringToTop: () => void;
  onSendToBottom: () => void;
  onHideOthers: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onClear: () => void;
  onMergeUp: () => void;
  onMergeDown: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // A control menu (it holds the opacity slider; docs/specs/004-interface-design/menus.md). The
  // ConfirmPopover claims Escape while it is open, so Escape here only ever closes the menu.
  const { attach, tree, surfaceProps } = useControlMenu({
    onClose,
    label: `${layer.name} layer menu`,
  });
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      attach(el);
    },
    [attach],
  );
  // Which destructive verb is awaiting its ConfirmPopover, plus the row it anchors to.
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'clear'; anchor: HTMLElement } | null>(
    null,
  );

  useClickOutside(ref, onClose, true, '[data-confirm-popover]');

  // Place the menu once it has a height; written straight to the style so the first paint is
  // already in place (no flash at the old position).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { left, top } = layerMenuPosition(anchor, el.offsetHeight, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [anchor]);

  const locked = isLayerLocked(layer);
  const visible = isLayerVisible(layer);
  const plural = elementCount === 1 ? 'element' : 'elements';
  // The confirm popover anchors to the row that asked.
  const clearRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);
  const ask = (kind: 'delete' | 'clear', row: HTMLElement | null) => {
    if (row) setConfirm({ kind, anchor: row });
  };
  // Run a one-shot verb and close: the result shows on the canvas and in the panel.
  const thenClose = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Portal>
      <MenuTreeContext.Provider value={tree}>
        <div
          ref={setRef}
          {...surfaceProps}
          data-testid="layer-row-menu"
          onContextMenu={(e) => e.preventDefault()}
          className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-64 flex-col rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50"
          style={{ left: anchor.panelLeft - MENU_GAP - MENU_WIDTH, top: MENU_GAP }}
        >
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-1">
            <span
              className={
                'flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white dark:bg-slate-950 ' +
                (thumbMarkup
                  ? 'border border-slate-200 dark:border-slate-700'
                  : 'border border-dashed border-slate-300 dark:border-slate-600')
              }
            >
              {thumbViewBox && thumbMarkup ? (
                <svg
                  viewBox={thumbViewBox}
                  preserveAspectRatio="xMidYMid meet"
                  className="h-full w-full"
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: thumbMarkup }}
                />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {layer.name}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {elementCount === 0 ? 'Empty' : `${elementCount} ${plural}`}
              </span>
            </span>
          </div>
          <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
            <OpacityRow value={layerOpacityOf(layer)} onChange={onSetOpacity} />
          </div>
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            icon={visible ? <EyeOffIcon /> : <EyeIcon />}
            label={visible ? 'Hide Layer' : 'Show Layer'}
            onClick={onToggleVisibility}
          />
          <MenuActionRow
            plain
            icon={locked ? <UnlockIcon /> : <LockIcon />}
            label={locked ? 'Unlock Layer' : 'Lock Layer'}
            onClick={onToggleLock}
          />
          <MenuActionRow
            plain
            icon={<SoloIcon />}
            label="Hide Others"
            disabled={isTop && isBottom}
            onClick={thenClose(onHideOthers)}
          />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            icon={<BringToTopIcon />}
            label="Bring to Top"
            disabled={isTop}
            onClick={onBringToTop}
          />
          <MenuActionRow
            plain
            icon={<SendToBottomIcon />}
            label="Send to Bottom"
            disabled={isBottom}
            onClick={onSendToBottom}
          />
          <MenuGroupSeparator />
          <MenuActionRow
            plain
            icon={<MergeUpIcon />}
            label="Merge With Layer Above"
            disabled={isTop}
            onClick={thenClose(onMergeUp)}
          />
          <MenuActionRow
            plain
            icon={<MergeDownIcon />}
            label="Merge With Layer Below"
            disabled={isBottom}
            onClick={thenClose(onMergeDown)}
          />
          <MenuGroupSeparator />
          <MenuActionRow plain icon={<RenameIcon />} label="Rename" onClick={thenClose(onRename)} />
          <div ref={clearRef}>
            <MenuActionRow
              plain
              icon={<ClearIcon />}
              label="Clear Layer"
              disabled={elementCount === 0}
              onClick={() => ask('clear', clearRef.current)}
            />
          </div>
          <div ref={deleteRef}>
            <MenuActionRow
              plain
              icon={<DeleteIcon />}
              label="Delete Layer"
              disabled={!canDelete}
              onClick={
                // An empty layer goes straight away; a populated one asks first.
                elementCount === 0 ? thenClose(onDelete) : () => ask('delete', deleteRef.current)
              }
            />
          </div>
        </div>
      </MenuTreeContext.Provider>
      {confirm ? (
        <ConfirmPopover
          anchor={confirm.anchor}
          message={
            confirm.kind === 'delete'
              ? `Delete “${layer.name}” and its ${elementCount} ${plural}?`
              : `Clear the ${elementCount} ${plural} on “${layer.name}”? The layer stays.`
          }
          confirmLabel={confirm.kind === 'delete' ? 'Delete' : 'Clear'}
          onConfirm={() => {
            setConfirm(null);
            onClose();
            if (confirm.kind === 'delete') onDelete();
            else onClear();
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </Portal>
  );
}
