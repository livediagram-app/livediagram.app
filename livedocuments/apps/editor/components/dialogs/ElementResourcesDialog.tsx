'use client';

import { elementKindLabel, isBoxed } from '@livedocuments/document';
import { ElementResourcesDialog as SharedElementResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ElementResourcesDialog';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the workbench's one copy, handed this editor's
// options (its quickBarItems, run through the handlers the menu itself used). This editor's elements take no links,
// so it hands in no link places. It takes what the menu's row took: a boxed element.
export function ElementResourcesDialog() {
  const editor = useEditorContext();
  const { resourcesOpenForId: openId, setResourcesOpenForId } = editor;
  const el = openId ? editor.activeTab.elements.find((e) => e.id === openId) : undefined;
  return (
    <SharedElementResourcesDialog
      openId={openId}
      target={el && isBoxed(el) ? el : undefined}
      name={elementKindLabel}
      onClose={() => setResourcesOpenForId(null)}
      options={(target) =>
        quickBarItems(target, {
          onAssignAction: editor.openAssignAction,
          onOpenComments: editor.openComments,
        })
      }
    />
  );
}
