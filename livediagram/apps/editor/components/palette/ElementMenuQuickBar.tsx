'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): a row of glyph buttons
// above the menu's first category holding the element kind's own verbs (a mind node's Add Child and Add Sibling, a
// flowchart step's, a relationship's cardinality), which the floating selection toolbar no longer carries. Not drawn on
// an element with none. Also here: quickBarItems, the Resources category's rows.
import { elementSendItem } from '@liveworkspace/workbench/components/send-to-plan/send-menu-item';
import {
  elementResourceOptions,
  resourceLinkModes,
  type ResourceOption,
} from '@liveworkspace/workbench/components/palette/element-resources';
import type { ReactNode } from 'react';
import { elementKindLabel, type BoxedElement, type Element } from '@livediagram/document';
import { LiveStatusMenuIcon } from '@/components/palette/context-menu-icons';
import {
  ElementKindToolButtons,
  useElementKindTools,
} from '@/components/canvas/element-kind-tools';
import { PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import { ClearStylesGlyph } from '@/components/canvas/quick-style-rows';
import { useClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// The Resources options offered on `target`, in order: what attaches to it. A link card and a video take their link from
// their own Link category, so Link is not offered on them (elementResourceOptions).
const LINK_MODES = resourceLinkModes({
  mode: 'document',
  label: 'Canvas',
  detail: 'Another canvas of yours',
});
export function quickBarItems(
  target: BoxedElement,
  props: Pick<
    EditorContextMenuProps,
    'onAssignAction' | 'onOpenComments' | 'onLinkElement' | 'onOpenNote' | 'onEditLiveStatus'
  > & {
    // The Resources dialog's own: what takes a link or a note off, and the tabs a link may name.
    onRemoveLink?: () => void;
    onRemoveNote?: (elementId: string) => void;
    tabs?: readonly { id: string; name: string }[];
    // A link place's own step inside the dialog (ResourceLinkPanel).
    linkPanel?: (mode: 'url' | 'tab' | 'document', done: () => void) => ReactNode;
  },
): ResourceOption[] {
  const options = elementResourceOptions(target, {
    onAssignAction: props.onAssignAction,
    onOpenComments: props.onOpenComments,
    onLinkElement: props.onLinkElement,
    onOpenNote: props.onOpenNote,
    onRemoveLink: props.onRemoveLink,
    onRemoveNote: props.onRemoveNote,
    linkModes: LINK_MODES,
    linkPanel: props.linkPanel,
    tabs: props.tabs,
  });
  // An Editor's binding to a status URL (docs/specs/009-elements/live-status.md "The Live Status dialog"): passed only
  // when this session may bind this shape on a deployment that checks.
  const { onEditLiveStatus } = props;
  if (onEditLiveStatus) {
    const statusUrl =
      target.type === 'shape' && typeof target.statusUrl === 'string' ? target.statusUrl : '';
    options.push({
      key: 'live-status',
      name: 'Live Status',
      label: 'Live Status…',
      icon: <LiveStatusMenuIcon />,
      on: !!statusUrl,
      detail: 'Whether its service is up',
      state: statusUrl
        ? statusUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : 'No status URL yet',
      run: () => onEditLiveStatus(target.id),
    });
  }
  // Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): a card for it in liveplanner, while this session
  // may send.
  const send = elementSendItem(target);
  if (send) options.push(send);
  return options;
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
      className="relative z-[1] flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800 [&>[aria-hidden]:last-child]:hidden"
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
