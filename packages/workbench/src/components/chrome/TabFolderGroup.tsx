'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { CollapseWidth, COLLAPSE_WIDTH_MS } from '../primitives/CollapseWidth';
import { FOLDER_CHIP_CLASS, FOLDER_SHELF_CLASS, folderStyle } from './folder-colour';
import { FolderStackGlyph } from './FolderStackGlyph';

// One tab folder in the strip (docs/specs/006-document/tab-folders.md "Tab bar rendering"), the same in every editor.
// It stands on its shelf, a tinted container shaped like a tab. Its chip, the folder's header, comes first: a folder
// glyph that stacks to say how many tabs it holds (one, two, or three for three or more) and the name, open or shut. Its tabs follow inline and open or shut in place, each easing its
// own width so the whole group slides as one. A 4px margin each side, on top of the strip's own 2px gap, keeps the
// shelf off the tabs and folders beside it (two folders in a row share one, the second's left margin dropped). The folder
// holding the open tab stays open and its chip won't shut it ("The folder holding the open tab stays open"): open is
// this visit's choice OR holding the open tab, worked out here as it draws and never written, so leaving the folder
// returns it to how this visit left it.

// How long a dragged tab rests on a collapsed chip before the folder springs open.
export const SPRING_OPEN_MS = 500;

export type TabFolderGroupProps<T extends { id: string }> = {
  name: string;
  tabs: T[];
  activeId: string;
  // This visit's own choice (TabStrip); the folder also shows open while it holds the open tab.
  expanded: boolean;
  readOnly: boolean;
  // Never called while the folder holds the open tab: it can't be shut then (a click shows the open tab instead).
  onToggle: () => void;
  // One member tab, rendered by the app (its TabFrame).
  renderTab: (tab: T) => ReactNode;
  // Dropping a dragged tab on the chip joins the folder at its head (the parent reorders before the first member).
  onJoin: (sourceId: string, firstMemberId: string) => void;
  onRename: (oldName: string, newName: string) => void;
  // The app's own rename field.
  renderRenameField: (field: {
    initial: string;
    onCommit: (value: string) => void;
    onCancel: () => void;
  }) => ReactNode;
  // Presence on the members tucked away, shown on the chip while collapsed.
  hiddenPresence?: (tabIds: string[]) => ReactNode;
  // Bring the whole folder into view once it has opened.
  onOpened?: (group: HTMLElement) => void;
  // Once it has shut, or opened because it now holds the open tab: the strip brings the open tab into view (the folder
  // shrinking can strand it past the edge; one opened round the open tab must show that tab, not its chip).
  onClosed?: () => void;
};

export function TabFolderGroup<T extends { id: string }>({
  name,
  tabs,
  activeId,
  expanded: chosen,
  readOnly,
  onToggle,
  renderTab,
  onJoin,
  onRename,
  renderRenameField,
  hiddenPresence,
  onOpened,
  onClosed,
}: TabFolderGroupProps<T>) {
  const [editing, setEditing] = useState(false);
  const [dropOver, setDropOver] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  // Holding the open tab keeps the folder open and locks its chip; nothing is written, so leaving undoes it.
  const holdsOpen = tabs.some((t) => t.id === activeId);
  const expanded = chosen || holdsOpen;
  // A click on a locked chip can't shut it; it brings the open tab back into view instead (reaching the chip on a
  // phone scrolls the strip back, leaving the open tab's menu button under the edge fade).
  const toggle = holdsOpen ? () => onClosed?.() : onToggle;

  // Once it has opened, the strip brings the folder into view (a phone's folder past the edge); once it has shut, or
  // opened round the open tab, the open tab.
  const opened = useRef(expanded);
  useEffect(() => {
    const was = opened.current;
    opened.current = expanded;
    if (expanded === was) return;
    const then =
      expanded && !holdsOpen
        ? () => groupRef.current && onOpened?.(groupRef.current)
        : () => onClosed?.();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(then, still ? 0 : COLLAPSE_WIDTH_MS + 20);
    return () => window.clearTimeout(timer);
  }, [expanded, holdsOpen, onOpened, onClosed]);

  // A dragged tab resting on a collapsed chip springs the folder open.
  const spring = useRef<number | null>(null);
  const cancelSpring = () => {
    if (spring.current != null) window.clearTimeout(spring.current);
    spring.current = null;
  };
  useEffect(() => cancelSpring, []);

  const hidden = expanded ? [] : tabs.filter((t) => t.id !== activeId).map((t) => t.id);
  const count = `${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`;

  return (
    <div
      ref={groupRef}
      data-tab-folder={name}
      data-expanded={expanded ? '' : undefined}
      style={folderStyle(name)}
      className={`${FOLDER_SHELF_CLASS} mx-1 flex h-10 shrink-0 items-end pr-0.5 [[data-tab-folder]+&]:ml-0`}
    >
      <div className="flex h-10 shrink-0 items-center">
        {editing && !readOnly ? (
          renderRenameField({
            initial: name,
            onCommit: (next) => {
              const trimmed = next.trim();
              if (trimmed && trimmed !== name) onRename(name, trimmed);
              setEditing(false);
            },
            onCancel: () => setEditing(false),
          })
        ) : (
          <HoverCard
            title={name}
            description={
              holdsOpen
                ? `${count}. It holds the tab you're on, so it stays open.${
                    readOnly ? '' : ' Double-click to rename.'
                  }`
                : `${count}. ${expanded ? 'Click to tuck them away' : 'Click to show them here'}${
                    readOnly ? '' : ', double-click to rename'
                  }.`
            }
          >
            <button
              type="button"
              // A key of the strip that opens or shuts its folder rather than opening a page.
              aria-expanded={expanded}
              // Holding the open tab, it can't be shut: still focusable, a drop target and renamed by a double-click.
              aria-disabled={holdsOpen || undefined}
              aria-label={`${name}, ${count}`}
              tabIndex={-1}
              data-tab-key=""
              data-folder-chip=""
              onClick={toggle}
              onDoubleClick={readOnly ? undefined : () => setEditing(true)}
              onDragEnter={
                readOnly || expanded
                  ? undefined
                  : () => {
                      if (spring.current == null)
                        spring.current = window.setTimeout(() => {
                          spring.current = null;
                          // Only a shut folder springs, and one holding the open tab is never shut.
                          onToggle();
                        }, SPRING_OPEN_MS);
                    }
              }
              onDragOver={
                readOnly
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (!dropOver) setDropOver(true);
                    }
              }
              onDragLeave={() => {
                cancelSpring();
                if (dropOver) setDropOver(false);
              }}
              onDrop={
                readOnly
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      cancelSpring();
                      setDropOver(false);
                      const src = e.dataTransfer.getData('text/plain');
                      const first = tabs[0];
                      if (src && first && src !== first.id) onJoin(src, first.id);
                    }
              }
              className={`${FOLDER_CHIP_CLASS}${dropOver ? ' outline-2 -outline-offset-2 outline-brand-500' : ''}`}
            >
              {/* The glyph stacks to say how many tabs the folder holds, open or shut; the exact count is in its
                  name and hover card. */}
              <span aria-hidden className="flex shrink-0 opacity-85">
                <FolderStackGlyph count={tabs.length} />
              </span>
              <span className="text-optical-line max-w-[10rem] truncate">{name}</span>
            </button>
          </HoverCard>
        )}
        {hidden.length > 0 && hiddenPresence ? (
          <span className="flex items-center pr-1.5">{hiddenPresence(hidden)}</span>
        ) : null}
      </div>
      {tabs.map((t) => (
        <CollapseWidth key={t.id} open={expanded}>
          <div className="flex items-end pl-0.5">{renderTab(t)}</div>
        </CollapseWidth>
      ))}
    </div>
  );
}
