'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideFolder } from '@liveworkspace/icons/lucide';
import { CollapseWidth, COLLAPSE_WIDTH_MS } from '../primitives/CollapseWidth';
import {
  FOLDER_BADGE_CLASS,
  FOLDER_CHIP_CLASS,
  FOLDER_SHELF_CLASS,
  folderStyle,
} from './folder-colour';

// One tab folder in the strip (docs/specs/006-document/tab-folders.md "Tab bar rendering"), the same in every editor.
// It stands on its shelf, a tinted container shaped like a tab. Its chip, the folder's header, comes first: a folder
// glyph, the name and the count badge, open or shut. Its tabs follow inline and open or shut in place, each easing its
// own width so the whole group slides as one. The open tab never tucks away: in a collapsed folder it stays on the
// shelf beside the chip.

// How long a dragged tab rests on a collapsed chip before the folder springs open.
export const SPRING_OPEN_MS = 500;

export type TabFolderGroupProps<T extends { id: string }> = {
  name: string;
  tabs: T[];
  activeId: string;
  expanded: boolean;
  readOnly: boolean;
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
  // Once it has shut: the strip brings the open tab back into view (the folder shrinking can strand it past the edge).
  onClosed?: () => void;
};

export function TabFolderGroup<T extends { id: string }>({
  name,
  tabs,
  activeId,
  expanded,
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

  // Once it has opened, the strip brings the folder into view (a phone's folder past the edge); once it has shut, the
  // open tab.
  const opened = useRef(expanded);
  useEffect(() => {
    const was = opened.current;
    opened.current = expanded;
    if (expanded === was) return;
    const then = expanded
      ? () => groupRef.current && onOpened?.(groupRef.current)
      : () => onClosed?.();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(then, still ? 0 : COLLAPSE_WIDTH_MS + 20);
    return () => window.clearTimeout(timer);
  }, [expanded, onOpened, onClosed]);

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
      role="presentation"
      data-tab-folder={name}
      data-expanded={expanded ? '' : undefined}
      style={folderStyle(name)}
      className={`${FOLDER_SHELF_CLASS} flex h-10 shrink-0 items-end pr-0.5`}
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
            description={`${count}. ${expanded ? 'Click to tuck them away' : 'Click to show them here'}${
              readOnly ? '' : ', double-click to rename'
            }.`}
          >
            <button
              type="button"
              // A tab of the strip that opens or shuts its folder rather than opening a page.
              role="tab"
              aria-selected={false}
              aria-expanded={expanded}
              aria-label={`${name}, ${count}`}
              tabIndex={-1}
              data-tab-key=""
              data-folder-chip=""
              onClick={onToggle}
              onDoubleClick={readOnly ? undefined : () => setEditing(true)}
              onDragEnter={
                readOnly || expanded
                  ? undefined
                  : () => {
                      if (spring.current == null)
                        spring.current = window.setTimeout(() => {
                          spring.current = null;
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
              <span aria-hidden className="flex shrink-0 opacity-85">
                <FolderGlyph />
              </span>
              <span className="text-optical-line max-w-[10rem] truncate">{name}</span>
              {/* The count stays, open or shut: how many tabs the folder holds. */}
              <span data-folder-count="" className={FOLDER_BADGE_CLASS}>
                {tabs.length}
              </span>
            </button>
          </HoverCard>
        )}
        {hidden.length > 0 && hiddenPresence ? (
          <span className="flex items-center pr-1.5">{hiddenPresence(hidden)}</span>
        ) : null}
      </div>
      {tabs.map((t) => (
        <CollapseWidth key={t.id} open={expanded || t.id === activeId}>
          <div className="flex items-end pl-0.5">{renderTab(t)}</div>
        </CollapseWidth>
      ))}
    </div>
  );
}

const FolderGlyph = lucideGlyph(lucideFolder, 14);
