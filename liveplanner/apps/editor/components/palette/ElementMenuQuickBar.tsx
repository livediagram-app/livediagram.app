'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): a row of glyph buttons above the
// menu's first category, so what gets reached for on any element is one press away rather than inside a category.
// Assign Action, Add Comment, Add Link and Add Note at the left (an element that has one says so, tinted, and the
// button reads View / Edit); Clear Styles alone at the right, apart from them, as it changes the element's look rather
// than attaching to it. Each button closes the menu as it runs, as the tiles it replaces did.
import type { ReactNode } from 'react';
import { isBoxed, type BoxedElement, type Element } from '@liveplanner/project';
import { Glyph, Tooltip } from '@liveplanner/ui';
import {
  ActionMenuIcon,
  CommentMenuIcon,
  LinkMenuIcon,
  NoteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { useClearStyles } from '@/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

type QuickBarItem = { key: string; label: string; icon: ReactNode; on: boolean; run: () => void };

// The items the bar offers on `target`, in order: what attaches to it. A link card and a video take their link from
// their own Link category, so the generic Add Link is not offered on them.
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments' | 'onLinkElement' | 'onOpenNote'
  >,
): QuickBarItem[] {
  const comments = (target as { commentThread?: { comments: readonly unknown[] } }).commentThread;
  const hasComments = !!comments && comments.comments.length > 0;
  const items: QuickBarItem[] = [
    {
      key: 'action',
      label: target.action ? 'View Action' : 'Assign Action',
      icon: <ActionMenuIcon />,
      on: !!target.action,
      run: () => props.onAssignAction(target.id),
    },
    {
      key: 'comment',
      label: hasComments ? 'View Comments' : 'Add Comment',
      icon: <CommentMenuIcon />,
      on: hasComments,
      run: () => props.onOpenComments(target.id),
    },
  ];
  if (target.type !== 'link-card' && target.type !== 'video')
    items.push({
      key: 'link',
      label: target.link ? 'Edit Link' : 'Add Link',
      icon: <LinkMenuIcon />,
      on: !!target.link,
      run: () => props.onLinkElement(target.id),
    });
  items.push({
    key: 'note',
    label: target.note ? 'Edit Note' : 'Add Note',
    icon: <NoteMenuIcon />,
    on: !!target.note,
    run: () => props.onOpenNote(target.id),
  });
  return items;
}

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600';
const REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
const ON =
  'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25';

export function ElementMenuQuickBar({
  target,
  props,
  attachments,
  onClose,
}: {
  target: Element;
  props: EditorContextMenuProps;
  // Whether the element takes actions, comments, links and notes (never a Plan item, never an arrow).
  attachments: boolean;
  onClose: () => void;
}) {
  const clearStyles = useClearStyles();
  const canClear = !!clearStyles && clearStyles.targetIds.has(target.id);
  // Only a boxed element takes them: arrows are never linked, noted, commented on or assigned.
  const items = attachments && isBoxed(target) ? quickBarItems(target, props) : [];
  if (!items.length && !canClear) return null;
  return (
    <div
      role="toolbar"
      aria-label="Quick actions"
      data-element-quick-bar=""
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800"
    >
      {items.map((item) => (
        <Tooltip key={item.key} label={item.label}>
          <button
            type="button"
            aria-label={item.label}
            aria-pressed={item.on || undefined}
            data-quick-bar={item.key}
            onClick={() => {
              item.run();
              onClose();
            }}
            className={`${BUTTON} ${item.on ? ON : REST}`}
          >
            {item.icon}
          </button>
        </Tooltip>
      ))}
      {canClear ? (
        <Tooltip label="Clear Styles">
          <button
            type="button"
            aria-label="Clear Styles"
            data-quick-bar="clear-styles"
            onClick={() => {
              // Tracked as the panel's Clear Styles is (QuickClearStyles): one action, two ways in.
              clearStyles.clear();
              onClose();
            }}
            className={`${BUTTON} ${REST} ml-auto`}
          >
            <ClearStylesGlyph />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

// Clear Styles: an eraser over a baseline.
function ClearStylesGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M9.5 2.5 13.5 6.5 7 13H3.5L2 11.5z" />
      <path d="M6 6l4 4" />
      <path d="M8 13h6" />
    </Glyph>
  );
}
