'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): one row of glyph buttons above the
// menu's first category. Assign Action and Add Comment at the left (an element that has one says so, tinted, and the
// button reads View), Delete alone at the right. Each button closes the menu as it runs.
import type { ReactNode } from 'react';
import { isBoxed, type BoxedElement, type Element } from '@livedocuments/document';
import { Tooltip } from '@livedocuments/ui';
import {
  ActionMenuIcon,
  CommentMenuIcon,
  RemoveIcon,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

type QuickBarItem = { key: string; label: string; icon: ReactNode; on: boolean; run: () => void };

// The items the bar offers on `target`, in order: what attaches to it.
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments'
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
  return items;
}

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-600';
const REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
const ON =
  'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25';

export function ElementMenuQuickBar({
  target,
  props,
  attachments,
  onDelete,
  onClose,
}: {
  target: Element;
  props: EditorContextMenuProps;
  // Whether the element takes actions and comments (never a Plan item, never an arrow).
  attachments: boolean;
  // Deletes the selection, which the right-click or long-press that opened the menu made this element.
  onDelete?: () => void;
  onClose: () => void;
}) {
  const locked = target.locked === true;
  // Only a boxed element takes them: arrows are never commented on or assigned.
  const items = attachments && isBoxed(target) ? quickBarItems(target, props) : [];
  if (!items.length && !onDelete) return null;
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
      {onDelete ? (
        <Tooltip label={locked ? 'Locked. Unlock it to delete.' : 'Delete'}>
          <button
            type="button"
            aria-label="Delete"
            data-quick-bar="delete"
            disabled={locked}
            onClick={() => {
              onClose();
              onDelete();
            }}
            className={`${BUTTON} ${REST} ml-auto`}
          >
            <RemoveIcon />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
