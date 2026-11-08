// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dashboardFromPreset,
  setDashboardContent,
  type DashboardLayout,
} from '@liveplanner/project';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';
import { track } from '@/lib/telemetry';
import { DashboardSettings } from '@/components/plan/dashboard/DashboardSettings';
import { DashboardTourStage, useDashboardTour } from './DashboardTour';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
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
  canvas.dataset.dashboard = '';
  // jsdom lays nothing out: every row and slot gets a box, so the overlay has something to measure.
  const box = { left: 10, top: 20, width: 900, height: 320, right: 910, bottom: 340 } as DOMRect;
  canvas.getBoundingClientRect = () => box;
  for (const row of layout.rows) {
    const r = document.createElement('div');
    r.dataset.dashboardRow = row.id;
    r.getBoundingClientRect = () => box;
    for (const slot of row.slots) {
      const s = document.createElement('div');
      s.dataset.dashboardSlot = slot.id;
      s.getBoundingClientRect = () => box;
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
  const r = render(page(canEdit));
  return {
    setCanEdit: (edit: boolean) => r.rerender(page(edit)),
    setLayout: (next: DashboardLayout) =>
      r.rerender(
        <DashboardSettings
          canvas={canvas}
          canEdit
          name="Overview"
          layout={next}
          actions={actions}
        />,
      ),
  };
}

const held = () => {
  const base = dashboardFromPreset('two-by-two', id);
  return setDashboardContent(base, base.rows[0]!.slots[0]!.id, {
    type: 'note',
    title: 'N',
    text: '',
  });
};

const fillAll = (l: DashboardLayout) =>
  l.rows
    .flatMap((r) => r.slots)
    .reduce((acc, s) => setDashboardContent(acc, s.id, { type: 'note', title: 'N', text: '' }), l);

const settle = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));

const startShowMe = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
  await settle();
};

// docs/specs/026-plan/plan-tabs.md "Show Me" and plan-tour.md "Dashboards: Layout View".
describe('Dashboard Show Me: Layout View', () => {
  const strip = () => screen.getByRole('region', { name: 'Layout View' });

  it('sits in the settings title row beside Help, for an Editor only', () => {
    show(held(), false);
    expect(screen.queryByRole('button', { name: 'Show Me' })).toBeNull();
    cleanup();
    show(held());
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Settings' }));
    expect(screen.getByRole('button', { name: 'Show Me' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /dashboards/i }).getAttribute('href')).toBe(
      '/help/plan/dashboards/',
    );
  });

  it('closes the popover and lays the grid over the page, with each slot’s span and each row’s height', async () => {
    const layout = held();
    show(layout);
    await startShowMe();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'DashboardTour');
    expect(document.querySelector('[data-dashboard]')?.hasAttribute('data-layout-view')).toBe(true);
    const spans = [...document.querySelectorAll('[data-layout-span]')].map((e) => e.textContent);
    expect(spans).toEqual(layout.rows.flatMap((r) => r.slots.map((s) => `${s.span} / 12`)));
    const heights = [...document.querySelectorAll('[data-layout-height]')].map(
      (e) => e.textContent,
    );
    expect(heights).toEqual(layout.rows.map((r) => `${r.height} px`));
    expect(screen.getByRole('img', { name: 'Mission 1 of 3' })).toBeTruthy();
    expect(strip().textContent).toContain('Resize Two Slots');
    // The filled slot's cog shows while it runs.
    const filled = document.querySelector('[data-dashboard-slot]:not([data-slot-empty])');
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(true);
  });

  it('climbs its hints, ringing the divider', async () => {
    show(held());
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(strip().textContent).toContain('Hover between two slots');
    fireEvent.click(screen.getByRole('button', { name: 'More Help' }));
    expect(strip().textContent).toContain('This bar.');
    expect(screen.queryByRole('button', { name: /Hint|More Help/ })).toBeNull();
  });

  it('ticks a mission off by the person’s own change, then moves on', async () => {
    const layout = held();
    const { setLayout } = show(layout);
    await startShowMe();
    const row0 = layout.rows[0]!;
    setLayout({
      ...layout,
      rows: [
        { ...row0, slots: row0.slots.map((s, i) => ({ ...s, span: i === 0 ? 8 : 4 })) },
        ...layout.rows.slice(1),
      ],
    });
    await settle();
    expect(strip().textContent).toContain('a row’s spans always add up to twelve');
    // The lesson stays until Next.
    await settle(1700);
    expect(screen.getByRole('img', { name: 'Mission 1 of 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('img', { name: 'Mission 2 of 3' })).toBeTruthy();
    expect(strip().textContent).toContain('Change a Row’s Height');
  });

  it('reports a skip from End, and lets go of the page', async () => {
    show(held());
    await startShowMe();
    fireEvent.click(screen.getByRole('button', { name: 'End Layout View' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourSkipped');
    expect(document.querySelector('[data-dashboard]')?.hasAttribute('data-layout-view')).toBe(
      false,
    );
    expect(document.querySelector('[data-layout-span]')).toBeNull();
  });

  it('finishes with Done, as completed', async () => {
    const layout = fillAll(held());
    const { setLayout } = show(layout);
    await startShowMe();
    // Every slot filled: no Fill a Slot, so two missions.
    expect(screen.getByRole('img', { name: 'Mission 1 of 2' })).toBeTruthy();
    const row0 = layout.rows[0]!;
    const resized = {
      ...layout,
      rows: [
        { ...row0, slots: row0.slots.map((s, i) => ({ ...s, span: i === 0 ? 8 : 4 })) },
        ...layout.rows.slice(1),
      ],
    };
    setLayout(resized);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const r0 = resized.rows[0]!;
    setLayout({ ...resized, rows: [{ ...r0, height: r0.height + 40 }, ...resized.rows.slice(1)] });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('img', { name: 'All 2 done' })).toBeTruthy();
    expect(strip().textContent).toContain('That’s the grid.');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourCompleted');
  });

  it('ends when the page can no longer be edited, letting go of the slot it was showing', async () => {
    const { setCanEdit } = show(held());
    await startShowMe();
    const filled = document.querySelector('[data-dashboard-slot]:not([data-slot-empty])');
    setCanEdit(false);
    await settle();
    expect(filled?.hasAttribute('data-tour-reveal')).toBe(false);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'DashboardTourSkipped');
    setCanEdit(true);
    await settle();
    expect(screen.queryByRole('region', { name: 'Layout View' })).toBeNull();
  });
});

// docs/specs/026-plan/plan-tour.md "Starting a tour": the footer's Start Tour opens a start panel first.
describe('Dashboards tour start panel', () => {
  function Stage({ layout }: { layout: DashboardLayout }) {
    const { tour } = useDashboardTour(false);
    return (
      <>
        <button type="button" onClick={() => tour.start(true)}>
          Footer Start
        </button>
        <button type="button" onClick={() => tour.start()}>
          Show Me Start
        </button>
        <DashboardTourStage tour={tour} layout={layout} />
      </>
    );
  }

  it('shows the start panel before the grid, then Show the Grid runs Layout View', async () => {
    const layout = held();
    drawPage(layout);
    render(<Stage layout={layout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Footer Start' }));
    const panel = screen.getByRole('region', { name: 'Dashboards Tour' });
    expect(panel.textContent).toContain('Layout View');
    expect(document.querySelector('[data-layout-span]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the Grid' }));
    await settle();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'DashboardTour');
    expect(screen.queryByRole('region', { name: 'Dashboards Tour' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Layout View' })).toBeTruthy();
    expect(document.querySelector('[data-layout-span]')).not.toBeNull();
  });

  it('closes on Not Now, with nothing started', () => {
    const layout = held();
    drawPage(layout);
    render(<Stage layout={layout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Footer Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not Now Dashboards Tour' }));
    expect(screen.queryByRole('region', { name: 'Dashboards Tour' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Layout View' })).toBeNull();
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'DashboardTour');
  });

  it('goes straight to the grid for Show Me', async () => {
    const layout = held();
    drawPage(layout);
    render(<Stage layout={layout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me Start' }));
    await settle();
    expect(screen.queryByRole('region', { name: 'Dashboards Tour' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Layout View' })).toBeTruthy();
  });
});
