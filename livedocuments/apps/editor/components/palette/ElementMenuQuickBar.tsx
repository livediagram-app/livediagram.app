'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): one row of glyph buttons above the
// menu's first category. Assign Action and Add Comment at the left (an element that has one says so, tinted, and the
// button reads View), Delete alone at the right. Each button closes the menu as it runs.
import { elementSendItem } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import {
  elementResourceOptions,
  type ResourceOption,
} from '@liveworkspace/workbench/components/palette/element-resources';
import { type BoxedElement, type Element } from '@livedocuments/document';
import { Tooltip } from '@livedocuments/ui';
import { RemoveIcon } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { useLibrary } from '@liveworkspace/workbench/components/library/LibraryProvider';
import { SaveToLibraryButton } from '@liveworkspace/workbench/components/library/SaveToLibraryButton';
import { libraryDraftOf } from '@/lib/library-draft';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The Resources options offered on `target`, in order: what attaches to it (elementResourceOptions).
export function quickBarItems(
  target: BoxedElement,
  props: Pick<EditorContextMenuProps, 'onAssignAction' | 'onOpenComments'>,
): ResourceOption[] {
  const options = elementResourceOptions(target, {
    onAssignAction: props.onAssignAction,
    onOpenComments: props.onOpenComments,
  });
  // Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): a card for it in liveplanner, while this session
  // may send.
  const send = elementSendItem(target);
  if (send) options.push(send);
  return options;
}

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-600';
const REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
export function ElementMenuQuickBar({
  target,
  onDelete,
  onClose,
}: {
  target: Element;
  // Deletes the selection, which the right-click or long-press that opened the menu made this element.
  onDelete?: () => void;
  onClose: () => void;
}) {
  const locked = target.locked === true;
  // Only a boxed element takes them: arrows are never commented on or assigned.
  // Save to Library (liveworkspace/docs/specs/006-media/libraries.md): livedocuments has no single-element toolbar, so
  // a single element saves from here. Not on a locked element; the menu opens for an Editor only.
  const saveable = useLibrary() !== null && !locked;
  if (!onDelete && !saveable) return null;
  return (
    <div
      role="toolbar"
      aria-label="Quick actions"
      data-element-quick-bar=""
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800"
    >
      {saveable ? (
        <SaveToLibraryButton
          draft={() => libraryDraftOf([target])}
          className={`${BUTTON} ${REST}`}
          onOpened={onClose}
        />
      ) : null}
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
