'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: an element-scoped menu (link / layer order / note /
// comment) or a canvas-scoped menu (change theme / canvas,
// auto-align, add shape / sticky). Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import type { ReactNode } from 'react';
import { isBoxed, type Element, type ShapeKind } from '@livediagram/diagram';
import { ContextMenu, ContextMenuDivider } from '@/components/ContextMenu';
import {
  AnnotationMenuIcon,
  AutoAlignIcon,
  CanvasMenuIcon,
  CommentMenuIcon,
  LayerDownIcon,
  LayerUpIcon,
  LinkMenuIcon,
  NoteMenuIcon,
  PaletteMenuIcon,
  PencilMenuIcon,
  SquareMenuIcon,
  StickyMenuIcon,
} from '@/components/context-menu-icons';
import { MenuItem } from '@/components/PortalMenu';

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  | { mode: 'canvas'; x: number; y: number };

type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  onClose: () => void;
  onLinkElement: (elementId: string) => void;
  // Remove an inline icon from the element. Only surfaced when the
  // clicked element actually carries one (a non-'icon' shape with iconId).
  onRemoveIcon: (elementId: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Toggle aspect-ratio lock + set opacity on the clicked element (boxed
  // only). Read the current values off the target below.
  onToggleAspectLock: () => void;
  onSetOpacity: (opacity: number) => void;
  onOpenNote: (elementId: string) => void;
  onOpenComments: (elementId: string) => void;
  onChangeTheme: () => void;
  onChangeCanvas: () => void;
  onAutoAlign: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddSticky: () => void;
  onDrawPencil: () => void;
  onAddAnnotation: () => void;
};

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };

  if (menu.mode === 'element') {
    const target = elements.find((el) => el.id === menu.elementId);
    if (!target) return null;
    const boxed = isBoxed(target);
    // A regular shape carrying an inline icon (drag-an-icon-onto-it
    // feature, spec/09) gets a "Remove icon" entry; the dedicated 'icon'
    // shape is its own glyph and excluded.
    const hasInlineIcon =
      target.type === 'shape' && target.shape !== 'icon' && target.iconId !== undefined;
    return (
      <ContextMenu position={position} onClose={onClose}>
        <MenuItem
          icon={<LinkMenuIcon />}
          label={target.link ? 'Edit link' : 'Link Element'}
          onClick={() => {
            props.onLinkElement(target.id);
            onClose();
          }}
        />
        {hasInlineIcon ? (
          <MenuItem
            icon={<RemoveIconGlyph />}
            label="Remove icon"
            onClick={() => {
              props.onRemoveIcon(target.id);
              onClose();
            }}
          />
        ) : null}
        <ContextMenuDivider />
        {/* Layer order — Front / Back share one row. */}
        <div className="flex gap-1 px-2 py-0.5">
          <MenuRowButton
            icon={<LayerUpIcon />}
            label="Front"
            onClick={() => {
              props.onBringToFront();
              onClose();
            }}
          />
          <MenuRowButton
            icon={<LayerDownIcon />}
            label="Back"
            onClick={() => {
              props.onSendToBack();
              onClose();
            }}
          />
        </div>
        {boxed ? (
          <>
            <ContextMenuDivider />
            <MenuItem
              icon={<AspectLockMenuIcon />}
              label={
                (target as { aspectLocked?: boolean }).aspectLocked
                  ? 'Unlock aspect ratio'
                  : 'Lock aspect ratio'
              }
              onClick={() => {
                props.onToggleAspectLock();
                onClose();
              }}
            />
            {/* Opacity slider — a non-closing row (dragging stays inside the
                menu, so the outside-click guard leaves it open). */}
            <OpacityRow
              value={(target as { opacity?: number }).opacity ?? 1}
              onChange={props.onSetOpacity}
            />
          </>
        ) : null}
        <ContextMenuDivider />
        {boxed ? (
          <MenuItem
            icon={<NoteMenuIcon />}
            label={target.note ? 'Edit note' : 'Add note'}
            onClick={() => {
              props.onOpenNote(target.id);
              onClose();
            }}
          />
        ) : null}
        <MenuItem
          icon={<CommentMenuIcon />}
          label="Comment"
          onClick={() => {
            props.onOpenComments(target.id);
            onClose();
          }}
        />
      </ContextMenu>
    );
  }

  return (
    <ContextMenu position={position} onClose={onClose}>
      <MenuItem
        icon={<PaletteMenuIcon />}
        label="Change Theme"
        onClick={() => {
          props.onChangeTheme();
          onClose();
        }}
      />
      <MenuItem
        icon={<CanvasMenuIcon />}
        label="Change Canvas"
        onClick={() => {
          props.onChangeCanvas();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<AutoAlignIcon />}
        label="Auto-align tab"
        onClick={() => {
          props.onAutoAlign();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<SquareMenuIcon />}
        label="Add square"
        onClick={() => {
          props.onAddShape('square');
          onClose();
        }}
      />
      <MenuItem
        icon={<StickyMenuIcon />}
        label="Add sticky"
        onClick={() => {
          props.onAddSticky();
          onClose();
        }}
      />
      <ContextMenuDivider />
      <MenuItem
        icon={<PencilMenuIcon />}
        label="Draw pencil"
        onClick={() => {
          props.onDrawPencil();
          onClose();
        }}
      />
      <MenuItem
        icon={<AnnotationMenuIcon />}
        label="Add annotation"
        onClick={() => {
          props.onAddAnnotation();
          onClose();
        }}
      />
    </ContextMenu>
  );
}

// A compact menu button used where two actions share one row (Front /
// Back). Mirrors MenuItem's tone but centres its icon + label and flexes
// to fill half the row.
function MenuRowButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      {label}
    </button>
  );
}

// Opacity slider row inside the context menu. Doesn't close the menu on
// interaction (it isn't a MenuItem): dragging fires pointer events inside
// the menu, so the ContextMenu's outside-click guard keeps it open.
function OpacityRow({ value, onChange }: { value: number; onChange: (opacity: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="px-3 py-1.5">
      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
        <span>Opacity</span>
        <span>{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="Opacity"
        className="w-full accent-brand-500"
      />
    </div>
  );
}

// Rectangle with corner ticks — "lock aspect ratio". 12x12 stroke style of
// the shared context-menu icons.
function AspectLockMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5 8.5v2.5h2.5M11 7.5V5H8.5" />
    </svg>
  );
}

// A star glyph with a slash — "remove the inline icon". Matches the
// 12x12 stroke style of the shared context-menu icons.
function RemoveIconGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  );
}
