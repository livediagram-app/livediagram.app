// @vitest-environment jsdom

// Element tours (docs/specs/007-editor/element-tours.md): the footer's Start Tour button offering a selected portal's
// tour until it is taken, a press starting it, the share-role gate, one tour at a time, and the tour ending when its element goes.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import {
  resetTourOffersForTests,
  tourOffer,
} from '@liveworkspace/workbench/components/tour/tour-offer';
import {
  createSelectionStore,
  type SelectionStore,
} from '@liveworkspace/workbench/lib/selection-store';
import { setActiveTour, activeTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import { ElementTourHost } from './ElementTourHost';
import type { ElementTourApi } from './element-tour-api';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({ engine: null as TourEngine<ElementTourApi> | null }));
vi.mock('./TourStage', () => ({
  TourStage: ({ engine }: { engine: TourEngine<ElementTourApi> }) => {
    stage.engine = engine;
    return null;
  },
}));
// Every anchor is there, so no step is skipped for a missing one.
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', () => ({
  findTour: () => null,
  waitForSelector: async () => document.body,
}));
const viewport = vi.hoisted(() => ({ phone: false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => viewport.phone,
}));
const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));

const setUserPreferences = vi.fn();
const writeUserPreferences = vi.fn();

const portal = { ...createShape('portal', 0, 0), id: 'p1' } as Element;
const square = { ...createShape('square', 0, 0), id: 'sq1' } as Element;

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    prefsSettled: true,
    anyWelcomeOpen: false,
    embedMode: false,
    can: { level: 'edit' },
    activeTab: { id: 'tab1', elements: [portal, square] },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    ...over,
  };
};

let store: SelectionStore;
const mount = () =>
  render(
    <SelectionStoreProvider store={store}>
      <ElementTourHost />
    </SelectionStoreProvider>,
  );
const rerenderWith = (r: ReturnType<typeof mount>) =>
  r.rerender(
    <SelectionStoreProvider store={store}>
      <ElementTourHost />
    </SelectionStoreProvider>,
  );

beforeEach(() => {
  store = createSelectionStore();
  track.mockReset();
  stage.engine = null;
});
afterEach(() => {
  cleanup();
  viewport.phone = false;
  vi.clearAllMocks();
  setActiveTour('avatar', false);
  setActiveTour('element', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
});

describe('ElementTourHost offer', () => {
  it('offers the tour for a selected portal, and nothing for a square', () => {
    editor();
    mount();
    expect(tourOffer()).toBeNull();
    act(() => store.setSelectedId('sq1'));
    expect(tourOffer()).toBeNull();
    act(() => store.setSelectedId('p1'));
    expect(tourOffer()).toMatchObject({ name: 'Portal' });
    act(() => tourOffer()!.onShown!());
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'PortalTourOffer');
  });

  it.each([
    ['a Participant', { can: { level: 'participate' } }],
    ['a Viewer', { can: { level: 'view' } }],
    ['locked', { activeTab: { id: 'tab1', elements: [{ ...portal, locked: true }] } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['under a welcome overlay', { anyWelcomeOpen: true }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    mount();
    act(() => store.setSelectedId('p1'));
    expect(tourOffer()).toBeNull();
  });

  it('never offers a tour on a phone', () => {
    viewport.phone = true;
    editor();
    mount();
    act(() => store.setSelectedId('p1'));
    expect(tourOffer()).toBeNull();
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'PortalTour');
  });

  it('makes no offer for a multi-selection', () => {
    editor();
    mount();
    act(() => store.setMultiSelectedIds(new Set(['p1', 'sq1'])));
    expect(tourOffer()).toBeNull();
  });

  it('starts nothing while another tour is on screen', () => {
    editor();
    mount();
    act(() => setActiveTour('avatar', true));
    act(() => store.setSelectedId('p1'));
    act(() => tourOffer()!.start());
    expect(stage.engine?.active).toBe(false);
  });

  // Work Tracker #177: a taken element tour leaves the button; its Settings › Show Me switch brings it back.
  it('leaves the button once taken, and comes back when its Settings switch is on again', () => {
    editor({ userPreferences: { elementTourKinds: ['portal'] } });
    const r = mount();
    act(() => store.setSelectedId('p1'));
    expect(tourOffer()).toBeNull();
    editor({ userPreferences: { elementTourKinds: [] } });
    rerenderWith(r);
    expect(tourOffer()?.name).toBe('Portal');
  });

  it('never starts on its own', () => {
    editor();
    mount();
    act(() => store.setSelectedId('p1'));
    expect(stage.engine?.active).toBe(false);
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'PortalTour');
  });
});

describe('ElementTourHost tour', () => {
  it('a press records the kind as taken, starts on the first step and holds the tour slot', () => {
    editor();
    mount();
    act(() => store.setSelectedId('p1'));
    act(() => tourOffer()!.start());
    expect(writeUserPreferences).toHaveBeenCalledWith({ elementTourKinds: ['portal'] }, 'me');
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PortalTour');
    expect(stage.engine?.active).toBe(true);
    expect(stage.engine?.step?.id).toBe('portal');
    expect(track).toHaveBeenCalledWith('UI', 'View', 'PortalTourStepPortal');
    expect(activeTour()).toBe('element');
  });

  it('ends as skipped when its diagram is deleted', () => {
    editor();
    const r = mount();
    act(() => store.setSelectedId('p1'));
    act(() => tourOffer()!.start());
    editor({ activeTab: { id: 'tab1', elements: [square] } });
    rerenderWith(r);
    expect(stage.engine?.active).toBe(false);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PortalTourSkipped');
  });

  it('ends as skipped on another tab', () => {
    editor();
    const r = mount();
    act(() => store.setSelectedId('p1'));
    act(() => tourOffer()!.start());
    editor({ activeTab: { id: 'tab2', elements: [portal] } });
    rerenderWith(r);
    expect(stage.engine?.active).toBe(false);
  });
});
