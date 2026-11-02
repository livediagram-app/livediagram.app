'use client';

// A Dashboard slot's own name (docs/specs/026-plan/plan-tabs.md "A slot's name"), handed to the plan view it shows
// (DashboardSlotContent's SlotElement): the view draws it in place of its generated heading, before the chart's own
// title. Read, never written back: the element keeps its settings as they are. Undefined outside a named slot.
import { createContext, useContext } from 'react';

export const SlotName = createContext<string | undefined>(undefined);

export function useSlotName(): string | undefined {
  return useContext(SlotName);
}
