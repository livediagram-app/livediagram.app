'use client';

import { useState, type ReactNode } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { PaletteTileGrid, type PaletteTileActions } from './PaletteTileGrid';
import { TOOL_GROUPS, tilesInToolGroup } from './palette-tile-defs';
import { track } from '@/lib/telemetry';

// The palette's creation-category tab bodies. Since spec/78 every tile is
// a data entry in the shared catalogue (palette-tile-defs.tsx) rendered
// through PaletteTileGrid, so each tab is just its catalogue slice — the
// per-tile JSX that used to live here (and in PaletteShapesTab /
// PaletteToolsTab / PaletteDataTab / DevicePickerTab) moved into the
// catalogue. The search-driven tabs (Icons / Technology) stay in
// CommandPalette since they own their search / filter state; the
// Favourites tab (spec/78) has its own file (PaletteFavouritesTab).

type TabProps = {
  pendingDraw: PendingDraw | null | undefined;
  actions: PaletteTileActions;
};

export function PaletteShapesTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="shapes" actions={actions} pendingDraw={pendingDraw} />;
}

// One collapsible group row in the Tools tab (spec/09 "Sub-categories"):
// an uppercase heading in the PaletteSectionLabel voice, promoted to a
// chevroned toggle button, with the same animated grid-rows collapse the
// context-menu accordions use (MenuAccordionSection) so the two accordion
// surfaces feel like one control.
function PaletteAccordionSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-300"
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>
      <div
        className={`grid transition-all duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

// The Tools tab's grouped accordions (spec/09 "Sub-categories"): the tools
// grouped by theme (Write / Draw / Structure / Blocks / People & media, from
// TOOL_GROUPS — a flat sixteen-tile wall stopped scanning), plus the Data
// charts (spec/53, folded in from the old standalone Data category). One
// group open at a time, the first open by default, so the tab stays one
// glance tall; clicking the open header collapses it.
export function PaletteToolsTab({ pendingDraw, actions }: TabProps) {
  const sections: { id: string; label: string; tiles?: ReturnType<typeof tilesInToolGroup> }[] = [
    ...TOOL_GROUPS.map((g) => ({ id: g.id, label: g.label, tiles: tilesInToolGroup(g.id) })),
    { id: 'data', label: 'Data' },
  ];
  const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);
  const toggle = (id: string) => {
    track('UI', 'Toggled', 'ToolGroup');
    setOpenId((cur) => (cur === id ? null : id));
  };
  return (
    <div className="flex flex-col">
      {sections.map((section) => (
        <PaletteAccordionSection
          key={section.id}
          label={section.label}
          open={openId === section.id}
          onToggle={() => toggle(section.id)}
        >
          {section.tiles ? (
            <PaletteTileGrid tiles={section.tiles} actions={actions} pendingDraw={pendingDraw} />
          ) : (
            <PaletteTileGrid section="data" actions={actions} pendingDraw={pendingDraw} />
          )}
        </PaletteAccordionSection>
      ))}
    </div>
  );
}

export function PaletteComponentsTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="components" actions={actions} pendingDraw={pendingDraw} />;
}

// Wireframing device-frame primitives (browser / monitor / laptop / phone /
// tablet / smartwatch) — see spec/09 "Devices".
export function DevicePickerTab({ pendingDraw, actions }: TabProps) {
  return <PaletteTileGrid section="devices" actions={actions} pendingDraw={pendingDraw} />;
}
