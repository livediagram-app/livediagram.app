'use client';

// A tab window's section (docs/specs/009-elements/tab-window.md "The menu"): Shows (the tabs it may show, an
// Editor's to change) and Open <name> (everyone's who sees the tab). Read from the editor itself: the menu renders
// outside the canvas, so the windows' own context is not here.
import { tabWindowMayShow, type ShapeElement } from '@livedocuments/document';
import { lucideAppWindow, lucideArrowUpRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { MenuAccordionSection, MenuActionRow } from '@/components/primitives/PortalMenu';
import { TabWindowTabList } from '@/components/canvas/tab-window/TabWindowTabList';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import type { ElementStyleOps } from '@/lib/element-style-ops';
import { track } from '@/lib/telemetry';

const WindowIcon = lucideGlyph(lucideAppWindow, 16);
const OpenIcon = lucideGlyph(lucideArrowUpRight, 16);

export function TabWindowMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const { tabs: allTabs, activeTab, can, activeTabLocked, isOutOfScope } = useEditorContext();
  const selectTab = useSelectTab();
  // As the windows see them (tab-window-context): a tab outside a tab-scoped link is never named or offered, and one
  // the window may not show (its own) has no Open.
  const tabs = allTabs.filter((t) => !isOutOfScope(t.id));
  const found = target.windowTabId ? tabs.find((t) => t.id === target.windowTabId) : undefined;
  const shown = found && tabWindowMayShow(found, activeTab.id) ? found : undefined;
  const mayChoose = can.level === 'edit' && !activeTabLocked && target.locked !== true;
  return (
    <MenuAccordionSection title="Tab Window" icon={<WindowIcon />} {...sectionProps('tab-window')}>
      {mayChoose ? (
        <div className="px-1 pb-1">
          <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Shows
          </p>
          <TabWindowTabList
            tabs={tabs}
            ownTabId={activeTab.id}
            shown={target.windowTabId}
            onPick={(tabId) =>
              ops.commit(
                (el) =>
                  el.type === 'shape' && el.shape === 'tab-window'
                    ? { ...el, windowTabId: tabId }
                    : el,
                'TabWindowTab',
              )
            }
          />
        </div>
      ) : null}
      {shown ? (
        <MenuActionRow
          label={`Open ${shown.name || 'Untitled tab'}`}
          icon={<OpenIcon />}
          onClick={() => {
            track('UI', 'Used', 'TabWindowOpen');
            selectTab(shown.id);
          }}
        />
      ) : null}
    </MenuAccordionSection>
  );
}
