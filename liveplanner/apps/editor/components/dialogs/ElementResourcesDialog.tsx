'use client';

import { elementKindLabel, isBoxed, takesAttachments } from '@liveplanner/project';
import { ElementResourcesDialog as SharedElementResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ElementResourcesDialog';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';
import { track } from '@/lib/telemetry';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the workbench's one copy, handed this editor's
// options (its quickBarItems, run through the handlers the menu itself used) and where its links go. It takes what
// the menu's row took: a boxed element that takes attachments.
export function ElementResourcesDialog() {
  const editor = useEditorContext();
  const { resourcesOpenForId: openId, setResourcesOpenForId } = editor;
  const el = openId ? editor.activeTab.elements.find((e) => e.id === openId) : undefined;
  return (
    <SharedElementResourcesDialog
      openId={openId}
      target={el && isBoxed(el) && takesAttachments(el) ? el : undefined}
      name={elementKindLabel}
      onClose={() => setResourcesOpenForId(null)}
      links={{
        app: 'liveplanner',
        kind: 'project',
        hostId: editor.projectId ?? '',
        tabs: editor.tabs,
        currentTabId: editor.activeId,
        onLink: editor.applyElementLink,
        track: (action, type) => track('Element', action, type),
      }}
      options={(target, links) =>
        quickBarItems(target, {
          onAssignAction: editor.openAssignAction,
          onLinkElement: editor.openLinkPicker,
          onOpenNote: editor.openNote,
          // An empty note is no note: the element drops it.
          onRemoveNote: (id) => editor.setNote(id, ''),
          ...links,
        })
      }
    />
  );
}
