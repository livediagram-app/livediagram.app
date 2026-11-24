'use client';

import { elementKindLabel, isBoxed } from '@livediagram/document';
import { ElementResourcesDialog as SharedElementResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ElementResourcesDialog';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { canBindLiveStatus } from '@/lib/live-status-input';
import { track } from '@/lib/telemetry';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the workbench's one copy, handed this editor's
// options (its quickBarItems, run through the handlers the menu itself used) and where its links go. It takes what
// the menu's row took: a boxed element.
export function ElementResourcesDialog() {
  const editor = useEditorContext();
  const { liveStatusEnabled } = useCapabilities();
  const { resourcesOpenForId: openId, setResourcesOpenForId } = editor;
  const el = openId ? editor.activeTab.elements.find((e) => e.id === openId) : undefined;
  return (
    <SharedElementResourcesDialog
      openId={openId}
      target={el && isBoxed(el) ? el : undefined}
      name={elementKindLabel}
      onClose={() => setResourcesOpenForId(null)}
      links={{
        app: 'livediagram',
        kind: 'document',
        hostId: editor.documentId ?? '',
        tabs: editor.tabs,
        currentTabId: editor.activeId,
        onLink: editor.applyElementLink,
        track,
      }}
      options={(target, links) =>
        quickBarItems(target, {
          onAssignAction: editor.openAssignAction,
          onOpenComments: editor.openComments,
          onLinkElement: editor.openLinkPicker,
          onOpenNote: editor.openNote,
          // Live Status, as the menu's row counted it: an Editor, on a shape that can be bound, where the
          // deployment checks.
          onEditLiveStatus:
            liveStatusEnabled && editor.can.level === 'edit' && canBindLiveStatus(target)
              ? editor.setLiveStatusOpenForId
              : undefined,
          // An empty note is no note: the element drops it.
          onRemoveNote: (id) => editor.setNote(id, ''),
          ...links,
        })
      }
    />
  );
}
