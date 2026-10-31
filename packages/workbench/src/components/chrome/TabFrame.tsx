'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { CollapseWidth } from '../primitives/CollapseWidth';
import { TAB_SLIDE_MS } from './useTabSlider';
import { TAB_CARET_CLASS, TAB_NAME_BUTTON_CLASS, TAB_NAME_CLASS, tabShapeClass } from './tab-shape';

// One footer tab, drawn alike in every editor (docs/specs/007-editor/editor-app.md "How a tab looks"): the shape,
// the name as the strip's `role="tab"`, its Tooltip when the name is cut short, the drag caret, and the slots each
// app fills (its rename field, presence avatars, menu button and any mark after the name).

export type TabDragHandlers = {
  onDragStart?: (e: ReactDragEvent) => void;
  onDragOver?: (e: ReactDragEvent) => void;
  onDragLeave?: (e: ReactDragEvent) => void;
  onDrop?: (e: ReactDragEvent) => void;
  onDragEnd?: (e: ReactDragEvent) => void;
};

export type TabFrameProps = {
  id: string;
  name: string;
  active: boolean;
  readOnly: boolean;
  // The rename field (the app's own), shown in place of the name while renaming.
  renameField?: ReactNode;
  // The tab theme's accent for the open tab's name, already made legible on its card.
  accent?: string;
  // A padlock before the name.
  lockIcon?: ReactNode;
  // After the name, inside its button (the side by side mark).
  afterName?: ReactNode;
  // Inside the tab after the name: presence avatars, then the menu button.
  presence?: ReactNode;
  // Whether `presence` shows anyone. Its slot eases open and shut with this (the avatars arriving on the tab you
  // open, leaving the one you left); omitted, the slot is open whenever `presence` is given.
  hasPresence?: boolean;
  // Given only while the tab is open; its slot eases in and out with the sliding card.
  menu?: ReactNode;
  // Where a dragged tab would land on this one, and whether this one is the tab being dragged.
  caret?: 'before' | 'after' | null;
  dragging?: boolean;
  dragHandlers?: TabDragHandlers;
  // Extra classes on the tab (the split view's dashed outline).
  className?: string;
  // The editor tour's anchor on the open tab.
  tourId?: string;
  onSelect: () => void;
  // Double-click on the open tab: rename it.
  onRequestRename?: () => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
};

export function TabFrame({
  id,
  name,
  active,
  readOnly,
  renameField,
  accent,
  lockIcon,
  afterName,
  presence,
  hasPresence,
  menu,
  caret = null,
  dragging = false,
  dragHandlers,
  className,
  tourId,
  onSelect,
  onRequestRename,
  onContextMenu,
}: TabFrameProps) {
  const editing = renameField != null;
  return (
    <div
      data-tab=""
      data-tab-id={id}
      data-active={active ? '' : undefined}
      data-tour-id={tourId}
      draggable={!editing && !readOnly}
      {...dragHandlers}
      onContextMenu={onContextMenu}
      style={active && !editing && accent ? { color: accent } : undefined}
      className={`${tabShapeClass({ active, editing, dragging })}${className ? ` ${className}` : ''}`}
    >
      {caret === 'before' ? (
        <span aria-hidden className={`${TAB_CARET_CLASS} -left-[2px]`} />
      ) : null}
      {caret === 'after' ? (
        <span aria-hidden className={`${TAB_CARET_CLASS} -right-[2px]`} />
      ) : null}
      {editing ? (
        renameField
      ) : (
        <TabName
          name={name}
          active={active}
          lockIcon={lockIcon}
          afterName={afterName}
          onSelect={onSelect}
          onDoubleClick={readOnly || !active ? undefined : onRequestRename}
        />
      )}
      {/* The slots ease their width with the strip's sliding card (useTabSlider measures where they will end), so
          nothing snaps while it travels. The gap-1 before them is cancelled while they are empty. */}
      <div className="-ml-1 flex items-center">
        <TabSlot node={presence} open={hasPresence ?? presence != null} lead="pl-1" />
        <TabSlot node={menu} lead="pl-1" />
        {/* The padding a tab without a menu button keeps (tabShapeClass trims it on every tab). */}
        <CollapseWidth open={menu == null && !editing} ms={TAB_SLIDE_MS} center>
          <span aria-hidden className="block w-2.5" />
        </CollapseWidth>
      </div>
    </div>
  );
}

// The name's button, with the full name in a Tooltip only when the name is cut short. Measured when the name changes
// and once the web fonts settle, never on hover, so the button is never remounted under the pointer.
function TabName({
  name,
  active,
  lockIcon,
  afterName,
  onSelect,
  onDoubleClick,
}: {
  name: string;
  active: boolean;
  lockIcon?: ReactNode;
  afterName?: ReactNode;
  onSelect: () => void;
  onDoubleClick?: () => void;
}) {
  const label = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = label.current;
    if (!el) return;
    const measure = () => setCut(el.scrollWidth > el.clientWidth + 1);
    measure();
    let live = true;
    void document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
    };
  }, [name]);
  const button = (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      // The strip's roving focus: Tab lands on the open tab, the arrows move between the rest (TabStrip).
      tabIndex={active ? 0 : -1}
      data-tab-key=""
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={TAB_NAME_BUTTON_CLASS}
    >
      {lockIcon ? <span className="flex shrink-0 opacity-70">{lockIcon}</span> : null}
      <span ref={label} className={TAB_NAME_CLASS}>
        {name}
      </span>
      {afterName}
    </button>
  );
  return cut ? <Tooltip label={name}>{button}</Tooltip> : button;
}

// One of the tab's trailing slots (the avatars, the menu button): its width and opacity ease with the card, its
// content scales a little (transform and opacity only, so it runs on the GPU). A slot that has just emptied keeps its
// last content for the length of the slide so it can ease away rather than vanish.
function TabSlot({ node, open, lead }: { node: ReactNode; open?: boolean; lead: string }) {
  const [held, setHeld] = useState<ReactNode>(node);
  if (node != null && node !== held) setHeld(node);
  const shown = open ?? node != null;
  useEffect(() => {
    if (shown || held == null) return;
    const id = window.setTimeout(() => setHeld(null), TAB_SLIDE_MS + 40);
    return () => window.clearTimeout(id);
  }, [shown, held]);
  return (
    <CollapseWidth open={shown} ms={TAB_SLIDE_MS} center>
      <div
        className={`flex origin-left items-center transition-transform ease-out motion-reduce:transition-none ${lead} ${
          shown ? 'scale-100' : 'scale-75'
        }`}
        style={{ transitionDuration: `${TAB_SLIDE_MS}ms` }}
      >
        {held}
      </div>
    </CollapseWidth>
  );
}
