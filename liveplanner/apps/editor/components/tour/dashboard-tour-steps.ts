// The steps of Show Me in Dashboard Settings (docs/specs/026-plan/plan-tabs.md "Show Me"): a tour of arranging and
// filling a dashboard, run on the page itself. Each step rings a real part of the page, which stays usable, so the
// Editor can fill a slot or drag a divider while the step is up.
import type { TourStepOf } from '@liveworkspace/workbench/components/tour/tour-step';
import { opensFrom } from '@liveworkspace/workbench/components/tour/tour-open';

// Nothing to drive: the steps only point, and the slot step shows the slot's hover-only controls itself.
export type DashboardTourApi = null;

type DashboardTourStep = TourStepOf<DashboardTourApi>;

const FIRST_EMPTY_SLOT = '[data-dashboard-slot][data-slot-empty]';
const FIRST_FILLED_SLOT = '[data-dashboard-slot]:not([data-slot-empty])';

// While the slot step is up its grip and cog show as they do on hover (DashboardSlotView reads the flag).
const REVEAL = 'tourReveal';
const revealSlot = () => {
  const slot = document.querySelector<HTMLElement>(FIRST_FILLED_SLOT);
  if (slot) slot.dataset[REVEAL] = '';
};
// Also the tour's own tidy-up when it ends under the slot step (DashboardTour.tsx).
export const hideSlot = () => {
  document.querySelectorAll<HTMLElement>('[data-tour-reveal]').forEach((el) => {
    delete el.dataset[REVEAL];
  });
};

const ROWS: DashboardTourStep = {
  id: 'rows',
  title: 'Rows of Slots',
  body: 'Drag between slots to resize them, or a row’s bottom edge to make it taller.',
  // A card on its own, no ring: one round a row runs the page's width.
};

const FILL: DashboardTourStep = opensFrom(
  {
    id: 'fill',
    title: 'Fill a Slot',
    body: 'Add to Slot picks what it shows: a tab, a board, a metric, a chart or a note.',
    // The slot's Add to Slot, not the slot: a ring round a slot lights a large part of the page.
    selector: () => `${FIRST_EMPTY_SLOT} [aria-haspopup="dialog"]`,
  },
  () => `${FIRST_EMPTY_SLOT} [aria-haspopup="dialog"]`,
);

const SLOT: DashboardTourStep = {
  id: 'slot',
  title: 'Change or Move a Slot',
  body: 'Its cog changes, clears or removes it. Drag its top grip to swap slots.',
  // The slot's own cog, shown as on hover through the step, else its Move grip (a board or Sheet in a slot carries
  // its own cog); never the whole slot.
  selector: () => {
    const cog = `${FIRST_FILLED_SLOT} [aria-label="Slot Settings"]`;
    return document.querySelector(cog) ? cog : `${FIRST_FILLED_SLOT} [aria-label="Move Slot"]`;
  },
  prepare: revealSlot,
  cleanup: hideSlot,
};

// Opened for the step and closed after: Show Me starts with the panel closed (the button closes it first).
const SETTINGS: DashboardTourStep = opensFrom(
  {
    id: 'settings',
    title: 'Dashboard Settings',
    body: 'Rename it, add a row, or start from another layout.',
    selector: () => '[data-dashboard-settings]',
  },
  () => '[data-dashboard-settings] button',
);

const OUTRO: DashboardTourStep = {
  id: 'outro',
  card: 'outro',
  title: 'That Is a Dashboard',
  body: 'Run this again from Dashboard Settings › Show Me.',
};

// The steps for this dashboard: Fill only with an empty slot to fill, the slot step only with a filled one.
export function dashboardTourSteps({
  hasEmpty,
  hasFilled,
}: {
  hasEmpty: boolean;
  hasFilled: boolean;
}): DashboardTourStep[] {
  return [ROWS, ...(hasEmpty ? [FILL] : []), ...(hasFilled ? [SLOT] : []), SETTINGS, OUTRO];
}
