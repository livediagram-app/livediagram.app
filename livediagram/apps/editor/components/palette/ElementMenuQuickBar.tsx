'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): a row of glyph buttons
// above the menu's first category holding the element kind's own verbs (a mind node's Add Child and Add Sibling, a
// flowchart step's, a relationship's cardinality), which the floating selection toolbar no longer carries. Not drawn on
// an element with none. Also here: quickBarItems, the Resources category's rows.
import { elementSendItem } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import type { ResourceItem } from '@liveworkspace/workbench/components/palette/ResourcesFlyout';
import { elementKindLabel, type BoxedElement, type Element } from '@livediagram/document';
import {
  ActionMenuIcon,
  CommentMenuIcon,
  LinkMenuIcon,
  LiveStatusMenuIcon,
  NoteMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  ElementKindToolButtons,
  useElementKindTools,
} from '@/components/canvas/element-kind-tools';
import { PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import { ClearStylesGlyph } from '@/components/canvas/quick-style-rows';
import { useClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The items the bar offers on `target`, in order: what attaches to it. A link card and a video take their link from
// their own Link category, so the generic Add Link is not offered on them.
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments' | 'onLinkElement' | 'onOpenNote' | 'onEditLiveStatus'
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
  // An Editor's binding to a status URL (docs/specs/009-elements/live-status.md "The Live Status dialog"): passed only
  // when this session may bind this shape on a deployment that checks.
  const { onEditLiveStatus } = props;
  if (onEditLiveStatus)
    items.push({
      key: 'live-status',
      detail: 'Whether its service is up',
      label: 'Live Status…',
      icon: <LiveStatusMenuIcon />,
      on: target.type === 'shape' && typeof target.statusUrl === 'string',
      run: () => onEditLiveStatus(target.id),
    });
  // Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): a card for it in liveplanner, while this session
  // may send.
  const send = elementSendItem(target);
  if (send) items.push(send);
  return items;
}

export function ElementMenuQuickBar({ target, onClose }: { target: Element; onClose: () => void }) {
  // The element kind's own verbs (element-kind-tools.tsx): Add Child, Add Step, cardinality and the like.
  const tools = useElementKindTools(target.id);
  // Clear Styles, last at the right after Save to Library: on an element whose look the Quick Style panel can reset.
  const clearStyles = useClearStyles();
  const canClear = !!clearStyles && clearStyles.targetIds.has(target.id);
  if (!tools && !canClear) return null;
  return (
    <div
      role="toolbar"
      aria-label={`${elementKindLabel(target)} tools`}
      data-element-quick-bar=""
      // A press on a verb runs it and closes the menu; a dropdown (Step Type, Lane, cardinality) closes it on its pick.
      onClickCapture={(e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (b && !b.hasAttribute('aria-haspopup')) queueMicrotask(onClose);
      }}
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800 [&>[aria-hidden]:last-child]:hidden"
    >
      {tools ? <ElementKindToolButtons tools={tools} /> : null}
      {canClear ? (
        <span className={tools?.saveToLibrary ? 'flex items-center' : 'ml-auto flex items-center'}>
          <PopoverButton
            label="Clear Styles"
            description="Put this element back to the tab's theme."
            onClick={() => clearStyles.clear()}
          >
            <ClearStylesGlyph />
          </PopoverButton>
        </span>
      ) : null}
    </div>
  );
}
