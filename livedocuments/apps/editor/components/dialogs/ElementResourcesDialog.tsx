'use client';

import { useEffect } from 'react';
import { elementKindLabel, isBoxed } from '@livedocuments/document';
import { ResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ResourcesDialog';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the options the menu's row counted, each run through the
// handlers the menu itself used. It takes what the menu's row took: a boxed element.
export function ElementResourcesDialog() {
  const {
    activeTab,
    resourcesOpenForId: openId,
    setResourcesOpenForId,
    openAssignAction,
    openComments,
  } = useEditorContext();
  const el = openId ? activeTab.elements.find((e) => e.id === openId) : undefined;
  const target = el && isBoxed(el) ? el : undefined;
  // Its element gone (deleted, undone away, on another tab): closed, never left to reopen by itself.
  const gone = openId !== null && !target;
  useEffect(() => {
    if (gone) setResourcesOpenForId(null);
  }, [gone, setResourcesOpenForId]);
  if (!target) return null;
  const options = quickBarItems(target, {
    onAssignAction: openAssignAction,
    onOpenComments: openComments,
  });
  if (!options.length) return null;
  return (
    <ResourcesDialog
      elementName={elementKindLabel(target)}
      options={options}
      onClose={() => setResourcesOpenForId(null)}
    />
  );
}
