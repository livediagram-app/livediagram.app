'use client';

import { useRef, useState } from 'react';
import { isLayerLocked, layerOpacityOf, type Layer } from '@livediagram/diagram';
import { Portal } from '@/components/primitives/Portal';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
} from '@/components/primitives/PortalMenu';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import { LayerDownIcon, LayersGlyph, LayerUpIcon } from '@/components/palette/context-menu-icons';
import { PencilIcon, TrashIcon } from '@/components/panels/explorer-icons';
import { useClickOutside } from '@/hooks/ui/useClickOutside';
import { useEscape } from '@/hooks/ui/useEscape';

// Right-click menu for a Layers-panel row (spec/74), styled like the tab
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
  const ref = useRef<HTMLDivElement>(null);
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
  useEscape(() => {
    if (confirm) setConfirm(null);
    else onClose();
  });

  const sectionProps = (key: string) => ({
    open: openSection === key,
    onToggle: () => setOpenSection((cur) => (cur === key ? null : key)),
  });
  const locked = isLayerLocked(layer);
  const plural = elementCount === 1 ? 'element' : 'elements';

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label={`${layer.name} layer actions`}
        onContextMenu={(e) => e.preventDefault()}
        className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-56 flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
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
        <MenuAccordionSection title="Layer" icon={<LayersGlyph />} flush {...sectionProps('layer')}>
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
              icon={<SoloEyeIcon />}
              label="Hide Others"
              disabled={isTop && isBottom}
              onClick={() => {
                onHideOthers();
                onClose();
              }}
            />
          </MenuTileGrid>
        </MenuAccordionSection>
        <MenuAccordionSection title="Content" icon={<ContentGlyph />} {...sectionProps('content')}>
          <MenuTileGrid cols={2}>
            <MenuTile
              icon={<PadlockIcon />}
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

function SoloEyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.5 7S3.5 3.5 7 3.5 12.5 7 12.5 7 10.5 10.5 7 10.5 1.5 7 1.5 7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}

function ContentGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 5.5h5M4.5 8.5h3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PadlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="6" width="8" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 4.5l5 5M9.5 4.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MergeGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 3.5h9M2.5 10.5h9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M7 5v4M5.2 7.2 7 9l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
