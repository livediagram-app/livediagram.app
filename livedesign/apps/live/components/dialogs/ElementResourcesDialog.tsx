'use client';

import { useEffect } from 'react';
import { elementKindLabel, isBoxed } from '@livedesign/design';
import { ResourceLinkPanel } from '@liveworkspace/workbench/components/dialogs/ResourceLinkPanel';
import { ResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ResourcesDialog';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';
import { track } from '@/lib/telemetry';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the options the menu's row counted, each run through the
// handlers the menu itself used. It takes what the menu's row took: a boxed element.
export function ElementResourcesDialog() {
  const {
    activeTab,
    tabs,
    resourcesOpenForId: openId,
    setResourcesOpenForId,
    openAssignAction,
    openComments,
    openLinkPicker,
    openNote,
    applyElementLink,
    setNote,
    activeId,
    designList,
    designId,
  } = useEditorContext();
  const el = openId ? activeTab.elements.find((e) => e.id === openId) : undefined;
  const target = el && isBoxed(el) ? el : undefined;
  // Its element gone (deleted, undone away, on another tab): closed, never left to reopen by itself.
  const gone = openId !== null && !target;
  useEffect(() => {
    if (gone) setResourcesOpenForId(null);
  }, [gone, setResourcesOpenForId]);
  if (!target) return null;
  const link = target.link;
  const options = quickBarItems(target, {
    onAssignAction: openAssignAction,
    onOpenComments: openComments,
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
    // A link's place is a step of this dialog, not a dialog of its own: the address, the tabs, the designs.
    linkPanel: (mode, done) => (
      <ResourceLinkPanel
        mode={mode === 'url' || mode === 'tab' ? mode : 'file'}
        current={{
          url: link?.kind === 'url' ? link.url : undefined,
          tabId: link?.kind === 'tab' || link?.kind === 'element' ? link.tabId : undefined,
          fileId: link?.kind === 'design' ? link.designId : undefined,
        }}
        tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
        currentTabId={activeId}
        files={designList
          .filter((d) => d.id !== designId)
          .slice(0, 8)
          .map((d) => ({ id: d.id, name: d.name }))}
        fileNoun="design"
        onPick={(pick) => {
          applyElementLink(
            pick.kind === 'file' ? { kind: 'design', designId: pick.id, name: pick.name } : pick,
          );
          track(
            'Element',
            'Linked',
            pick.kind === 'url' ? 'Url' : pick.kind === 'file' ? 'Design' : 'Tab',
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
