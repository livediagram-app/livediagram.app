// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dashboardFromPreset,
  setDashboardContent,
  type DashboardLayout,
} from '@livepages/document';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { track } from '@/lib/telemetry';
import { DashboardSettings } from '@/components/plan/dashboard/DashboardSettings';
import { dashboardTourSteps } from './dashboard-tour-steps';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the document" here.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.mocked(track).mockClear();
});

let n = 0;
const id = () => `id${n++}`;

// The page the tour points at, as DashboardRowView and DashboardSlotView draw it.
function drawPage(layout: DashboardLayout): HTMLElement {
  const canvas = document.createElement('div');
  for (const row of layout.rows) {
    const r = document.createElement('div');
    r.dataset.dashboardRow = '';
    for (const slot of row.slots) {
      const s = document.createElement('div');
      s.dataset.dashboardSlot = slot.id;
      // An empty slot's Add to Slot, a filled one's Move grip: what the steps ring, never the whole slot.
      const control = document.createElement('button');
      if (!slot.content) {
        s.dataset.slotEmpty = '';
        control.setAttribute('aria-haspopup', 'dialog');
      } else control.setAttribute('aria-label', 'Move Slot');
      s.append(control);
      r.append(s);
    }
    canvas.append(r);
  }
  document.body.append(canvas);
  return canvas;
}

function show(layout: DashboardLayout, canEdit = true) {
  const canvas = drawPage(layout);
  const actions = { changeDashboard: vi.fn() } as unknown as PlanTabActions;
  const page = (edit: boolean) => (
    <DashboardSettings
      canvas={canvas}
      canEdit={edit}
      name="Overview"
      layout={layout}
      actions={actions}
    />
  );
  const { rerender } = render(page(canEdit));
  return { setCanEdit: (edit: boolean) => rerender(page(edit)) };
}

const held = () => {
  const base = dashboardFromPreset('two-by-two', id);
  return setDashboardContent(base, base.rows[0]!.slots[0]!.id, {
    type: 'note',
    title: 'N',
    text: '',
  });
};

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));

const startShowMe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
  await settle();
};

// docs/specs/026-plan/plan-tabs.md "Show Me".
describe('Dashboard Show Me', () => {
  it('points at what the dashboard has: an empty slot to fill, a filled one to change', () => {
    const ids = (hasEmpty: boolean, hasFilled: boolean) =>
      dashboardTourSteps({ hasEmpty, hasFilled }).map((s) => s.id);
    expect(ids(true, true)).toEqual(['rows', 'fill', 'slot', 'settings', 'outro']);
    expect(ids(true, false)).toEqual(['rows', 'fill', 'settings', 'outro']);
    expect(ids(false, true)).toEqual(['rows', 'slot', 'settings', 'outro']);
  });

  it('sits in the settings title row beside Help, for an Editor only', () => {
    show(held(), false);
    expect(screen.queryByRole('button', { name: 'Show Me' })).toBeNull();
    cleanup();
    show(held());
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Settings' }));
    expect(screen.getByRole('button', { name: 'Show Me' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /dashboards/i }).getAttribute('href')).toBe(
      '/help/canvas/plan-mode/dashboards/',
    );
  });

  it('closes the popover and starts on the rows, counting the steps this dashboard has', async () => {
    show(dashboardFromPreset('two-by-two', id));
    await startShowMe();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    // Every slot empty: Rows, Fill and Settings.
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 3: Rows of Slots/ }),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'DashboardTour');
  });

  it('shows the filled slot’s grip and cog while its step is up, and hides them after', async () => {
    show(held());
    await startShowMe();
    const next = () => fireEvent.click(screen.getByRole('button', { name: /next/i }));
    next(); // Fill a Slot
    await settle();
    next(); // Change or Move a Slot
    await settle();
    expect(screen.getByRole('dialog', { name: /Change or Move a Slot/ })).toBeTruthy();
    const filled = document.querySelector('[data-dashboard-slot]:not([data-slot-empty])');
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(true);
    next(); // Dashboard Settings
    await settle();
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(false);
  });

  it('reports a skip when left before its end', async () => {
    show(held());
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourSkipped');
  });

  it('ends when the page can no longer be edited, letting go of the slot it was showing', async () => {
    const { setCanEdit } = show(held());
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // Fill a Slot
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // Change or Move a Slot
    await settle();
    const filled = document.querySelector('[data-dashboard-slot]:not([data-slot-empty])');
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(true);
    setCanEdit(false);
    await settle();
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(false);
    setCanEdit(true);
    await settle();
    expect(screen.queryByRole('dialog', { name: /^Show Me step/ })).toBeNull();
    expect(track).not.toHaveBeenCalledWith('UI', 'Ended', expect.anything());
  });
});
