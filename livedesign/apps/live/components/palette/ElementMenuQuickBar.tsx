'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): a row of glyph buttons above the
// menu's first category, so what gets reached for on any element is one press away rather than inside a category.
// Assign Action, Add Comment, Add Link and Add Note at the left (an element that has one says so, tinted, and the
// button reads View / Edit); Clear Styles alone at the right, apart from them, as it changes the element's look rather
// than attaching to it. Each button closes the menu as it runs, as the tiles it replaces did.
import { elementSendItem } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import {
  elementResourceOptions,
  appLinkModes,
  type AppLinkMode,
  type ResourceOption,
} from '@liveworkspace/workbench/components/palette/element-resources';
import type { ReactNode } from 'react';
import { type BoxedElement, type Element } from '@livedesign/design';
import { Tooltip } from '@livedesign/ui';
import { ClearStylesGlyph } from '@/components/canvas/quick-style-rows';
import { useClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The Resources options offered on `target`, in order: what attaches to it. A link card and a video take their link from
// their own Link category, so Link is not offered on them (elementResourceOptions).
// A link's places: a web address, a tab, then a file of each product, this app's first.
const LINK_MODES = appLinkModes('livedesign', 'design');
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments' | 'onLinkElement' | 'onOpenNote'
  > & {
    // The Resources dialog's own: what takes a link or a note off, and the tabs a link may name.
    onRemoveLink?: () => void;
    onRemoveNote?: (elementId: string) => void;
    tabs?: readonly { id: string; name: string }[];
    // A link place's own step inside the dialog (ResourceLinkPanel).
    linkPanel?: (mode: 'url' | 'tab' | 'design' | AppLinkMode, done: () => void) => ReactNode;
  },
): ResourceOption[] {
  const options = elementResourceOptions<(typeof LINK_MODES)[number]['mode']>(target, {
    onAssignAction: props.onAssignAction,
    onOpenComments: props.onOpenComments,
    // The link picker knows this app's own places; another product's files are picked in the dialog's own step.
    onLinkElement:
      props.onLinkElement &&
      ((id, mode) =>
        props.onLinkElement?.(id, mode?.startsWith('app:') ? undefined : (mode as never))),
    onOpenNote: props.onOpenNote,
    onRemoveLink: props.onRemoveLink,
    onRemoveNote: props.onRemoveNote,
    linkModes: LINK_MODES,
    linkPanel: props.linkPanel,
    tabs: props.tabs,
  });
  // Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): a card for it in liveplanner, while this session
  // may send.
  const send = elementSendItem(target);
  if (send) options.push(send);
  return options;
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
