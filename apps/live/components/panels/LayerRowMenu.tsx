'use client';

import { PencilIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { useCallback, useRef, useState } from 'react';
import { isLayerLocked, layerOpacityOf, type Layer } from '@livediagram/document';
import { EyeIcon, LockIcon } from '@/components/panels/layers-panel-icons';
import { ClearIcon } from '@/components/chrome/tab-bar-icons';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { MenuAccordionSection, MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import {
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
} from '@/components/primitives/MenuTiles';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import {
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  MENU_ICON_PX,
} from '@/components/palette/context-menu-icons';
import { lucideGlyph, MenuTreeContext, useClickOutside, useControlMenu, Portal } from '@livediagram/ui';
import { lucideFileText, lucideMerge } from '@livediagram/icons/lucide';

// Right-click menu for a Layers-panel row (docs/specs/006-document/layers.md), styled like the tab
// menu: a quick-verbs toolbar (Rename / Delete) over collapsible
// categories — Layer (opacity + restack-to-edge + hide others), Content
// (lock + clear), Merge (into the neighbour above / below). Anchored to
// the LEFT of the panel so it never covers the rows it acts on; grows
// upward from the row since the panel lives in the bottom corner.
// Destructive verbs (Delete on a populated layer, Clear) confirm via the
// shared ConfirmPopover before firing.
export function LayerRowMenu({
  layer,
  elementCount,
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
  onToggleLock,
  onClear,
  onMergeUp,
  onMergeDown,
}: {
  layer: Layer;
  elementCount: number;
  isTop: boolean;
  isBottom: boolean;
  // Where to hang the menu: the panel's left edge + the clicked row's
  // bottom, in viewport coords (the menu grows up-left from there).
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
  // The toolbar Delete's wrapper — the ConfirmPopover anchors to it,
  // mirroring the tab menu.
  const deleteRef = useRef<HTMLDivElement>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  // Which destructive verb is awaiting its ConfirmPopover, plus the
  // trigger element it anchors to.
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'clear'; anchor: HTMLElement } | null>(
    null,
  );

  useClickOutside(ref, onClose, true, '[data-confirm-popover]');

  const sectionProps = (key: string) => ({
    open: openSection === key,
    onToggle: () => setOpenSection((cur) => (cur === key ? null : key)),
  });
  const locked = isLayerLocked(layer);
  const plural = elementCount === 1 ? 'element' : 'elements';

  return (
    <Portal>
      <MenuTreeContext.Provider value={tree}>
        <div
          ref={setRef}
          {...surfaceProps}
          onContextMenu={(e) => e.preventDefault()}
          className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-56 outline-none flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
          style={{
            // Up-left from the panel's edge at the clicked row, so the menu
            // sits beside the panel instead of covering it. `max` keeps a
            // tall menu from poking off the top of the viewport.
            left: anchor.panelLeft - 8,
            top: Math.max(8, anchor.rowBottom),
            transform: 'translate(-100%, -100%)',
          }}
        >
          <MenuToolbar>
            <MenuToolButton
              icon={<PencilIcon />}
              label="Rename"
              description="Rename this layer."
              onClick={() => {
                onClose();
                onRename();
              }}
            />
            <div ref={deleteRef} className="ml-auto">
              <MenuToolButton
                icon={<TrashIcon />}
                label="Delete"
                description={
                  canDelete
                    ? 'Delete this layer and everything on it.'
                    : 'The last layer can’t be deleted.'
                }
                onClick={() => {
                  if (elementCount === 0) {
                    onClose();
                    onDelete();
                    return;
                  }
                  if (deleteRef.current) setConfirm({ kind: 'delete', anchor: deleteRef.current });
                }}
                danger
                disabled={!canDelete}
              />
            </div>
          </MenuToolbar>
          <MenuGroupSeparator />
          {/* flush: the MenuGroupSeparator above already draws the rule, so
            the first section skips its own border-t (no double line). */}
          <MenuAccordionSection
            title="Layer"
            icon={<LayersGlyph />}
            flush
            {...sectionProps('layer')}
          >
            <OpacityRow value={layerOpacityOf(layer)} onChange={onSetOpacity} />
            <MenuTileGrid cols={3}>
              <MenuTile
                icon={<LayerUpIcon />}
                label="Bring to Top"
                disabled={isTop}
                onClick={onBringToTop}
              />
              <MenuTile
                icon={<LayerDownIcon />}
                label="Send to Back"
                disabled={isBottom}
                onClick={onSendToBottom}
              />
              <MenuTile
                icon={<EyeIcon />}
                label="Hide Others"
                disabled={isTop && isBottom}
                onClick={() => {
                  onHideOthers();
                  onClose();
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
          <MenuAccordionSection
            title="Content"
            icon={<ContentGlyph />}
            {...sectionProps('content')}
          >
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<LockIcon size={14} />}
                label={locked ? 'Unlock' : 'Lock'}
                active={locked}
                onClick={onToggleLock}
              />
              <MenuTile
                icon={<ClearIcon />}
                label="Clear"
                danger
                disabled={elementCount === 0}
                onClick={() => {
                  const anchorEl = ref.current;
                  if (anchorEl) setConfirm({ kind: 'clear', anchor: anchorEl });
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
          <MenuAccordionSection title="Merge" icon={<MergeGlyph />} {...sectionProps('merge')}>
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<LayerUpIcon />}
                label="With Layer Above"
                disabled={isTop}
                onClick={() => {
                  onClose();
                  onMergeUp();
                }}
              />
              <MenuTile
                icon={<LayerDownIcon />}
                label="With Layer Below"
                disabled={isBottom}
                onClick={() => {
                  onClose();
                  onMergeDown();
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
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

const ContentGlyph = lucideGlyph(lucideFileText, MENU_ICON_PX);
const MergeGlyph = lucideGlyph(lucideMerge, MENU_ICON_PX);
