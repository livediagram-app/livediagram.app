'use client';

// The Shapes flyout (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows", "Shape
// slots"): a search field, focused as the flyout opens (hover included), over the six slots in two
// unlabelled rows, Recent over Most used (each row named for screen readers only). Typing replaces them with at most six of the catalogue's
// shapes, best first; never the full list. Previews in the board's ink. A slot or a result can be
// dragged onto the bar's pinned side, or pinned from its menu. Fixed size, so typing never resizes
// the flyout; the slots are taken as it opens, so they never change under the pointer.

import { useEffect, useId, useRef, useState } from 'react';
import { Tooltip } from '@livediagram/ui';
import { SearchInput } from '@/components/primitives/SearchInput';
import { WHITEBOARD_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';
import { useLongPress } from '@/hooks/ui/useLongPress';
import type { WhiteboardShapeEntry, WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import type { ShapeSlots, SlotSource } from '@/lib/whiteboard-shape-slots';
import { ShapePreview } from './ShapePreview';
import type { ShapeSlotDragApi } from './useShapeSlotDrag';
import { useShapeSearch } from './useShapeSearch';

const isMenuKey = (e: React.KeyboardEvent) =>
  (e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu';

export function ShapesFlyout({
  ink,
  slots,
  slotDrag,
  onPick,
  onPin,
  onEngage,
}: {
  ink: string;
  slots: ShapeSlots;
  slotDrag: ShapeSlotDragApi;
  // `searched`: picked from typed results rather than a slot.
  onPick: (key: WhiteboardShapeKey, searched: boolean) => void;
  // Pin to dock, from an entry's menu.
  onPin: (key: WhiteboardShapeKey) => void;
  // The user started typing or walking the grid: a hover-opened flyout stays open for them.
  onEngage: () => void;
}) {
  const base = useId();
  const listboxId = `${base}-results`;
  const optionId = (key: string) => `${base}-${key}`;
  // Taken as the flyout opens: a pick made elsewhere never reshuffles them under the pointer.
  const [shownSlots] = useState(slots);
  const { query, setQuery, searching, groups, flat, active, setActive, onKeyDown } = useShapeSearch(
    shownSlots,
    onPick,
  );
  const current = flat[active];
  const activeId = current ? optionId(current.key) : undefined;
  const [menuFor, setMenuFor] = useState<WhiteboardShapeKey | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuFor) menuRef.current?.focus({ preventScroll: true });
  }, [menuFor]);

  const closeMenu = () => {
    setMenuFor(null);
    fieldRef.current?.querySelector('input')?.focus({ preventScroll: true });
  };

  let index = 0;
  return (
    <div data-shape-search="" className="relative flex w-[8.5rem] flex-col gap-2">
      <div ref={fieldRef}>
        <SearchInput
          value={query}
          onChange={(next) => {
            onEngage();
            setMenuFor(null);
            setQuery(next);
          }}
          placeholder="Search shapes"
          ariaLabel="Search shapes"
          clearAriaLabel="Clear the shape search"
          clearDescription="Clear the shape search."
          onKeyDown={(e) => {
            if (e.key !== 'Escape' && e.key !== 'Tab') onEngage();
            if (isMenuKey(e)) {
              e.preventDefault();
              if (current) setMenuFor(current.key);
              return;
            }
            onKeyDown(e);
          }}
          activeDescendantId={activeId}
          listboxId={listboxId}
        />
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label={searching ? 'Matching shapes' : 'Shapes'}
        className="flex h-[5.25rem] flex-col gap-1"
      >
        {flat.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No shapes match
          </p>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-label={group.label}
              data-shape-row={group.id}
              className="grid grid-cols-3 gap-1"
            >
              {group.entries.map((entry) => {
                const at = index++;
                return (
                  <ShapeEntry
                    key={entry.key}
                    id={optionId(entry.key)}
                    entry={entry}
                    ink={ink}
                    selected={at === active}
                    dragged={slotDrag.drag?.source.key === entry.key}
                    onHover={() => (at === active ? undefined : setActive(at))}
                    onPick={() => {
                      if (slotDrag.consumeClick()) return;
                      onPick(entry.key, searching);
                    }}
                    onPointerDown={slotDrag.onSlotPointerDown}
                    onMenu={() => {
                      setActive(at);
                      setMenuFor(entry.key);
                    }}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>
      {/* The reached shape's name: the grid shows pictures, and the arrows need a word. */}
      <p
        aria-hidden
        data-shape-search-name=""
        className="h-4 truncate text-xs text-slate-600 dark:text-slate-300"
      >
        {current?.label ?? ''}
      </p>
      {menuFor ? (
        // The entry's menu, inside the flyout so it stays open: one choice.
        <button
          ref={menuRef}
          type="button"
          data-shape-menu=""
          onClick={() => {
            const key = menuFor;
            setMenuFor(null);
            onPin(key);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            closeMenu();
          }}
          onBlur={() => setMenuFor(null)}
          className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-700 shadow-md hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Pin to dock
        </button>
      ) : null}
    </div>
  );
}

function ShapeEntry({
  id,
  entry,
  ink,
  selected,
  dragged,
  onHover,
  onPick,
  onPointerDown,
  onMenu,
}: {
  id: string;
  entry: WhiteboardShapeEntry;
  ink: string;
  selected: boolean;
  dragged: boolean;
  onHover: () => void;
  onPick: () => void;
  onPointerDown: (e: React.PointerEvent, source: SlotSource) => void;
  onMenu: () => void;
}) {
  const longPressed = useRef(false);
  const longPress = useLongPress(() => {
    longPressed.current = true;
    onMenu();
  });
  const key = entry.dockShape ? WHITEBOARD_TOOL_KEYS[entry.dockShape] : undefined;
  return (
    <Tooltip label={entry.label}>
      <div
        id={id}
        role="option"
        aria-selected={selected}
        aria-label={entry.label}
        aria-keyshortcuts={key}
        data-shape-option={entry.key}
        onPointerDown={(e) => {
          // Focus stays in the field; the press may become a drag onto the bar.
          e.preventDefault();
          longPressed.current = false;
          longPress.onPointerDown(e);
          onPointerDown(e, { key: entry.key, from: 'flyout' });
        }}
        onPointerMove={onHover}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onPick();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onMenu();
        }}
        className={`relative flex h-10 w-10 cursor-pointer touch-none items-center justify-center rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
          selected ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : ''
        } ${dragged ? 'opacity-40' : ''}`}
      >
        <ShapePreview entry={entry} colour={ink} />
        {key ? (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0.5 right-1 text-[8px] font-medium uppercase leading-none text-slate-500 dark:text-slate-400"
          >
            {key}
          </span>
        ) : null}
      </div>
    </Tooltip>
  );
}
