'use client';

// A Dashboard slot's settings, handed to what the slot shows (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): an
// item has one menu, its cog. A board, a Sheet or a chart with a cog of its own folds the slot's **Slot** section into
// that cog's popover (`sections`); a header with no cog (a Diagram tab, a chart for someone who may not change it)
// shows the slot's own cog (`cog`) last among its controls. Null everywhere else (a board on its own tab, on the
// canvas), and in a slot with nothing to offer (a Viewer's slot that shows no tab).
import { createContext, useContext, type ReactNode } from 'react';

// A cog popover's toggle for its section `id`: one section open at a time, the slot's among the host's own.
export type SectionToggle = (id: string) => { open: boolean; onToggle: () => void };

export interface SlotSettingsValue {
  // The slot's section(s), for a host's cog: given the popover's toggle and a way to close it.
  sections: (section: SectionToggle, close: () => void) => ReactNode;
  // The slot's own cog (Slot Settings), for a header with no cog of its own.
  cog: ReactNode;
  // The slot's toolbar (Open Tab, Duplicate, Clear, Remove), drawn by any cog inside the slot above its sections
  // (SettingsCog), given a way to close the popover.
  toolbar: (close: () => void) => ReactNode;
}

export const SlotSettings = createContext<SlotSettingsValue | null>(null);

export function useSlotSettings(): SlotSettingsValue | null {
  return useContext(SlotSettings);
}

// The section id the slot's section takes in a host's popover.
export const SLOT_SECTION = 'slot';

// A press on a Style row's flyout or its colour pickers keeps the slot's popover open.
export const SLOT_KEEP_OPEN = '[data-menu-flyout],[data-anchored-popover]';
