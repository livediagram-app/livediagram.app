// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  readDashboard,
  shapeColorPresets,
  type DashboardContent,
  type DashboardLayout,
  type Tab,
} from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardSlotView } from './DashboardSlotView';

// docs/specs/026-plan/plan-tabs.md "Card style": a Utility's Slot Settings cog carries the element menu's Style flyout,
// with only what a card in a slot can take, for an Editor only.
vi.mock('./DashboardSlotContent', () => ({ DashboardSlotContent: () => <div>card</div> }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

function show(content: DashboardContent, over: Partial<DashboardContextValue> = {}) {
  const changeDashboard = vi.fn();
  const value: DashboardContextValue = {
    tabs: [] as Tab[],
    elements: new Map(),
    canEdit: true,
    actions: {
      setSlotContent: vi.fn(),
      placeItem: vi.fn(),
      removeSlot: vi.fn(),
      changeDashboard,
    } as unknown as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
    ...over,
  };
  const view = render(
    <DashboardContext.Provider value={value}>
      <DashboardSlotView
        rowId="r"
        slot={{ id: 's', span: 6, content }}
        at={{ slot: 0, row: 0, slots: 2 }}
      />
    </DashboardContext.Provider>,
  );
  return { changeDashboard, view };
}

const openMenu = () =>
  fireEvent.click(screen.getAllByRole('button', { name: 'Slot Settings' })[0]!);
const sectionTitles = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => /^[A-Z][a-z]+$/.test(t));
const frame = (view: ReturnType<typeof render>) =>
  view.container.querySelector<HTMLElement>('[data-dashboard-slot] > div:last-of-type');
const status: DashboardContent = { type: 'status', state: 'on-track', text: '', at: 0 };

describe('a Utility’s Style row', () => {
  it('offers Presets, Colours, Border and Shadow, and nothing a card in a slot cannot use', () => {
    show(status);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /Style/ }));
    const titles = sectionTitles();
    for (const t of ['Presets', 'Colours', 'Border', 'Shadow']) expect(titles).toContain(t);
    for (const t of ['Layer', 'Size', 'Rotation', 'Animation', 'Tools', 'Collaborate', 'Resources'])
      expect(titles).not.toContain(t);
  });

  it('applies a preset as one change, previewing it on hover first', () => {
    const { changeDashboard, view } = show(status);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /Style/ }));
    fireEvent.click(screen.getByRole('button', { name: /Presets/ }));
    const solid = shapeColorPresets(getTheme(undefined)).find((p) => p.id === 'solid')!;
    const tile = screen.getByRole('button', { name: /Solid/ });
    fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    expect(frame(view)?.style.backgroundColor).not.toBe('');
    fireEvent.pointerLeave(tile, { pointerType: 'mouse' });
    expect(changeDashboard).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(tile);
    });
    expect(changeDashboard).toHaveBeenCalledTimes(1);
    const [change, kind] = changeDashboard.mock.calls[0]!;
    expect(kind).toBe('DashboardCardStyle');
    const before = readDashboard({
      rows: [{ id: 'r', height: 320, slots: [{ id: 's', span: 12, content: status }] }],
    })!;
    const after = (change as (l: DashboardLayout) => DashboardLayout)(before);
    expect(after.rows[0]!.slots[0]!.content).toMatchObject({ style: { preset: 'solid' } });
    expect(solid.fill).toBeTruthy();
  });

  it('gives a Title its text colour alone', () => {
    show({ type: 'title', title: 'Q3', text: '' });
    openMenu();
    const titles = sectionTitles();
    expect(titles).toContain('Colours');
    expect(titles).not.toContain('Presets');
    expect(titles).not.toContain('Shadow');
  });

  it('is an Editor’s: a Participant or Viewer, and a slot that is not a Utility, get none', () => {
    show(status, { canEdit: false });
    expect(screen.queryAllByRole('button', { name: 'Slot Settings' })).toHaveLength(0);
    cleanup();
    show({ type: 'element', elementId: 'gone' });
    openMenu();
    expect(screen.queryByRole('button', { name: /Style/ })).toBeNull();
  });
});
