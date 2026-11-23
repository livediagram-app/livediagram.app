'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): a row of glyph buttons above the
// menu's first category, so what gets reached for on any element is one press away rather than inside a category.
// Assign Action, Add Comment, Add Link and Add Note at the left (an element that has one says so, tinted, and the
// button reads View / Edit); Clear Styles alone at the right, apart from them, as it changes the element's look rather
// than attaching to it. Each button closes the menu as it runs, as the tiles it replaces did.
import { elementSendItem } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import type { ResourceItem } from '@liveworkspace/workbench/components/palette/ResourcesFlyout';
import { type BoxedElement, type Element } from '@livedesign/design';
import { Tooltip } from '@livedesign/ui';
import {
  ActionMenuIcon,
  CommentMenuIcon,
  LinkMenuIcon,
  NoteMenuIcon,
} from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { ClearStylesGlyph } from '@/components/canvas/quick-style-rows';
import { useClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The items the bar offers on `target`, in order: what attaches to it. A link card and a video take their link from
// their own Link category, so the generic Add Link is not offered on them.
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments' | 'onLinkElement' | 'onOpenNote'
  >,
): ResourceItem[] {
  const comments = (target as { commentThread?: { comments: readonly unknown[] } }).commentThread;
  const hasComments = !!comments && comments.comments.length > 0;
  const items: ResourceItem[] = [
    {
      key: 'action',
      detail: 'What a click on it does',
      label: target.action ? 'View Action' : 'Assign Action',
      icon: <ActionMenuIcon />,
      on: !!target.action,
      run: () => props.onAssignAction(target.id),
    },
    {
      key: 'comment',
      detail: 'A thread to talk it over',
      label: hasComments ? 'View Comments' : 'Add Comment',
      icon: <CommentMenuIcon />,
      on: hasComments,
      run: () => props.onOpenComments(target.id),
    },
  ];
  if (target.type !== 'link-card' && target.type !== 'video')
    items.push({
      key: 'link',
      detail: 'A page or tab it opens',
      label: target.link ? 'Edit Link' : 'Add Link',
      icon: <LinkMenuIcon />,
      on: !!target.link,
      run: () => props.onLinkElement(target.id),
    });
  items.push({
    key: 'note',
    detail: 'Words kept behind it',
    label: target.note ? 'Edit Note' : 'Add Note',
    icon: <NoteMenuIcon />,
    on: !!target.note,
    run: () => props.onOpenNote(target.id),
  });
  // Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): a card for it in liveplanner, while this session
  // may send.
  const send = elementSendItem(target);
  if (send) items.push(send);
  return items;
}

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600';
const REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export function ElementMenuQuickBar({ target, onClose }: { target: Element; onClose: () => void }) {
  const clearStyles = useClearStyles();
  const canClear = !!clearStyles && clearStyles.targetIds.has(target.id);
  // Only a boxed element takes them: arrows are never linked, noted, commented on or assigned.
  if (!canClear) return null;
  return (
    <div
      role="toolbar"
      aria-label="Quick actions"
      data-element-quick-bar=""
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800"
    >
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
