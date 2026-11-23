'use client';

import { useEffect } from 'react';
import { elementKindLabel, isBoxed, takesAttachments } from '@liveplanner/project';
import { ResourceLinkPanel } from '@liveworkspace/workbench/components/dialogs/ResourceLinkPanel';
import { ResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ResourcesDialog';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';
import { track } from '@/lib/telemetry';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the options the menu's row counted, each run through the
// handlers the menu itself used. It takes what the menu's row took: a boxed element that takes attachments.
export function ElementResourcesDialog() {
  const {
    activeTab,
    tabs,
    resourcesOpenForId: openId,
    setResourcesOpenForId,
    openAssignAction,
    openLinkPicker,
    openNote,
    applyElementLink,
    setNote,
    activeId,
    projectList,
    projectId,
  } = useEditorContext();
  const el = openId ? activeTab.elements.find((e) => e.id === openId) : undefined;
  const target = el && isBoxed(el) && takesAttachments(el) ? el : undefined;
  // Its element gone (deleted, undone away, on another tab): closed, never left to reopen by itself.
  const gone = openId !== null && !target;
  useEffect(() => {
    if (gone) setResourcesOpenForId(null);
  }, [gone, setResourcesOpenForId]);
  if (!target) return null;
  const link = target.link;
  const options = quickBarItems(target, {
    onAssignAction: openAssignAction,
    onLinkElement: openLinkPicker,
    onOpenNote: openNote,
    // The link comes off the selection, which the menu that opened this made the element (as the link picker's
    // own Remove does).
    onRemoveLink: () => {
      applyElementLink(null);
      track('Element', 'Unlinked');
    },
    // An empty note is no note: the element drops it.
    onRemoveNote: (id) => setNote(id, ''),
    tabs,
    // A link's place is a step of this dialog, not a dialog of its own: the address, the tabs, the plans.
    linkPanel: (mode, done) => (
      <ResourceLinkPanel
        mode={mode === 'url' || mode === 'tab' ? mode : 'file'}
        current={{
          url: link?.kind === 'url' ? link.url : undefined,
          tabId: link?.kind === 'tab' || link?.kind === 'element' ? link.tabId : undefined,
          fileId: link?.kind === 'project' ? link.projectId : undefined,
        }}
        tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
        currentTabId={activeId}
        files={projectList
          .filter((d) => d.id !== projectId)
          .slice(0, 8)
          .map((d) => ({ id: d.id, name: d.name }))}
        fileNoun="plan"
        onPick={(pick) => {
          applyElementLink(
            pick.kind === 'file' ? { kind: 'project', projectId: pick.id, name: pick.name } : pick,
          );
          track(
            'Element',
            'Linked',
            pick.kind === 'url' ? 'Url' : pick.kind === 'file' ? 'Project' : 'Tab',
          );
          done();
        }}
      />
    ),
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
