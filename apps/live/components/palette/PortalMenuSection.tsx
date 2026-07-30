'use client';

// The Portal element's menu section (spec/104): its name, where it leads, and
// a way to make the other end when it doesn't exist yet.
//
// Its own file rather than another branch inside ElementDataSections: the
// portal is the only element setting that reaches across tabs, so it carries
// candidate grouping, a text field, and a create action that none of the other
// data sections need.
//
// The NAME lives here and only here. It shows in this picker, in the travel
// tooltip, and in the linked portal's label — never drawn on the canvas ring,
// where a caption over the energy looked like a sticker on a window.

import { useEffect, useState } from 'react';
import type { ShapeElement, Tab } from '@livediagram/diagram';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { portalName, portalSites } from '@/lib/portals';

function PlusGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6.5 2.4v8.2M2.4 6.5h8.2" />
    </svg>
  );
}

export function PortalMenuSection({
  portal,
  tabs,
  activeTabId,
  onSetPortalTarget,
  onSetPortalName,
  onCreateLinkedPortal,
  sectionProps,
}: {
  portal: ShapeElement;
  tabs: Tab[];
  activeTabId: string;
  onSetPortalTarget: (targetId: string | null) => void;
  onSetPortalName: (name: string) => void;
  onCreateLinkedPortal: () => void;
  // The accordion plumbing from the menu scaffold (open state + toggle).
  sectionProps: { open: boolean; onToggle: () => void };
}) {
  // Typed locally and committed on blur / Enter, like every other text field in
  // the editor: committing per keystroke would push one history entry per
  // letter. Re-seeded when the menu opens on a different portal.
  const [name, setName] = useState(portal.label ?? '');
  useEffect(() => {
    setName(portal.label ?? '');
  }, [portal.id, portal.label]);

  // Every OTHER portal in the diagram, this tab first — a link can cross tabs
  // (walk through here, come out on the Detail tab), so the candidate list is
  // diagram-wide and each off-tab option says which tab it lives on.
  const candidates = portalSites(tabs)
    .filter((site) => site.portal.id !== portal.id)
    .map((site) => {
      const tab = tabs.find((t) => t.id === site.tabId);
      return {
        id: site.portal.id,
        name: portalName(tab?.elements ?? [], site.portal),
        tabName: site.tabId === activeTabId ? null : site.tabName,
      };
    })
    .sort((a, b) => Number(a.tabName !== null) - Number(b.tabName !== null));

  // The positional name this portal answers to when it has no label, so the
  // placeholder shows what the pickers will call it ("Portal 3") rather than a
  // generic word.
  const ownName = portalName(tabs.find((t) => t.id === activeTabId)?.elements ?? [], portal);

  const commitName = () => {
    if ((portal.label ?? '') !== name.trim()) onSetPortalName(name);
  };

  return (
    <MenuAccordionSection title="Portal" icon={<ToolsMenuGlyph />} {...sectionProps}>
      <div className="px-3 pt-1">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitName();
              }
              // The menu listens for keys; typing a name must not trigger them.
              e.stopPropagation();
            }}
            placeholder={ownName}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
      </div>
      <p className="px-3 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Leads to
      </p>
      <MenuTileGrid cols={2}>
        {candidates.map((candidate) => (
          <MenuTile
            key={candidate.id}
            icon={<ToolsMenuGlyph />}
            label={candidate.tabName ? `${candidate.name} · ${candidate.tabName}` : candidate.name}
            active={portal.portalTarget === candidate.id}
            onClick={() =>
              // Picking the current target again unlinks it, so the tiles
              // double as an off switch.
              onSetPortalTarget(portal.portalTarget === candidate.id ? null : candidate.id)
            }
          />
        ))}
        {/* Always offered, and the only option when this is the first portal in
            the diagram: the far end usually doesn't exist yet. */}
        <MenuTile icon={<PlusGlyph />} label="Create portal" onClick={onCreateLinkedPortal} />
      </MenuTileGrid>
    </MenuAccordionSection>
  );
}
