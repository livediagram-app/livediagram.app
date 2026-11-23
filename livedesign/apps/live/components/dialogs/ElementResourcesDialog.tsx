'use client';

import { useEffect } from 'react';
import { elementKindLabel, isBoxed } from '@livedesign/design';
import { ResourceLinkPanel } from '@liveworkspace/workbench/components/dialogs/ResourceLinkPanel';
import {
  appFileUrl,
  type AppLinkMode,
} from '@liveworkspace/workbench/components/palette/element-resources';
import type { AppName } from '@liveworkspace/sites';
import { ResourcesDialog } from '@liveworkspace/workbench/components/dialogs/ResourcesDialog';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { quickBarItems } from '@/components/palette/ElementMenuQuickBar';
import { track } from '@/lib/telemetry';

// The Resources dialog for the element the menu's Resources row was pressed on
// (docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the options the menu's row counted, each run through the
// handlers the menu itself used. It takes what the menu's row took: a boxed element.
const HERE: AppName = 'livedesign';
const appOfMode = (mode: AppLinkMode): AppName => mode.slice(4) as AppName;

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
    linkPanel: (mode, done) => {
      // This app's own file keeps its own link kind; another product's is linked by its address.
      const app =
        mode === 'url' || mode === 'tab' ? null : mode === 'design' ? HERE : appOfMode(mode);
      return (
        <ResourceLinkPanel
          mode={app ? { app } : (mode as 'url' | 'tab')}
          current={{
            url: link?.kind === 'url' ? link.url : undefined,
            tabId: link?.kind === 'tab' || link?.kind === 'element' ? link.tabId : undefined,
            fileId: link?.kind === 'design' ? link.designId : undefined,
          }}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          currentTabId={activeId}
          hostId={designId ?? ''}
          onPick={(pick) => {
            applyElementLink(
              pick.kind !== 'file'
                ? pick
                : pick.app === HERE
                  ? { kind: 'design', designId: pick.id, name: pick.name }
                  : { kind: 'url', url: appFileUrl(pick.app, pick.id) },
            );
            track(
              'Element',
              'Linked',
              pick.kind === 'url'
                ? 'Url'
                : pick.kind === 'tab'
                  ? 'Tab'
                  : pick.app === HERE
                    ? 'Design'
                    : 'App',
            );
            done();
          }}
        />
      );
    },
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
