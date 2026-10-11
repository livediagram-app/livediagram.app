'use client';

// A Dashboard slot's own cog, **Slot Settings** (docs/specs/026-plan/plan-tabs.md "Editing"), for an item with no cog
// of its own: in the header of a Diagram tab or a chart someone may not change, or floating at the top right of a
// metric, a utility or an empty slot. Its popover holds a utility's **Style** row (an Editor's) over the **Slot**
// section, open as it opens. An item with a cog of its own folds the Slot section into that cog instead.
import { useState, type ReactNode } from 'react';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { SettingsCog } from '../SettingsCog';
import { planPalette } from '../plan-palette';
import { SLOT_KEEP_OPEN, SLOT_SECTION, type SlotSettingsValue } from './slot-menu';

export const SLOT_SETTINGS = 'Slot Settings';

export function SlotCog({
  sections,
  head,
  floating = false,
}: {
  sections: SlotSettingsValue['sections'];
  // Rows above the Slot section (a utility's Style), given a way to close the popover.
  head?: ((close: () => void) => ReactNode) | undefined;
  floating?: boolean;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  return (
    <SettingsCog
      label={SLOT_SETTINGS}
      palette={palette}
      floating={floating}
      keepOpenWithin={SLOT_KEEP_OPEN}
    >
      {(close) => <SlotCogPanel sections={sections} head={head} close={close} />}
    </SettingsCog>
  );
}

function SlotCogPanel({
  sections,
  head,
  close,
}: {
  sections: SlotSettingsValue['sections'];
  head: ((close: () => void) => ReactNode) | undefined;
  close: () => void;
}) {
  // The Slot section is all there is to open: open as the popover opens.
  const [open, setOpen] = useState<string | null>(SLOT_SECTION);
  const section = (id: string) => ({
    open: open === id,
    onToggle: () => setOpen((s) => (s === id ? null : id)),
  });
  return (
    <>
      {head ? (
        <div className="border-b border-slate-100 px-1 pb-1 dark:border-slate-800">
          {head(close)}
        </div>
      ) : null}
      {sections(section, close)}
    </>
  );
}
