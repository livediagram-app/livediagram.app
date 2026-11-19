// @vitest-environment jsdom

// Element tours (docs/specs/007-editor/element-tours.md): the Play button beside the selection toolbar offering a selected Sankey's
// tour until it is taken, a press starting it, the share-role gate, one tour at a time, and the tour ending when its diagram goes.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { resetTourOffersForTests } from '@liveworkspace/workbench/components/tour/tour-offer';
import { registerSankeyFlowsDialog } from '@liveworkspace/workbench/lib/sankey-flows-dialog-handle';
import {
  createSelectionStore,
  type SelectionStore,
} from '@liveworkspace/workbench/lib/selection-store';
import { setActiveTour, activeTour } from '@/lib/tour-active';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import type { TourEngine } from '@liveworkspace/workbench/components/tour/useTourEngine';
import type { SankeyElementTourApi } from './sankey-element-tour-steps';
import { ElementTourHost } from './ElementTourHost';
import { elementTourOffer, setElementTourOffer } from '@/lib/element-tour-offer';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const stage = vi.hoisted(() => ({ engine: null as TourEngine<SankeyElementTourApi> | null }));
vi.mock('./TourStage', () => ({
  TourStage: ({ engine }: { engine: TourEngine<SankeyElementTourApi> }) => {
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
const setSankeyFlowsOpenForId = vi.fn();

const sankey = { ...createShape('sankey', 0, 0), id: 'sk1' } as Element;
const square = { ...createShape('square', 0, 0), id: 'sq1' } as Element;
const stack = { ...createShape('layer-stack', 0, 0), id: 'ls1' } as Element;

const editor = (over: Record<string, unknown> = {}) => {
  ctx.current = {
    hydrated: true,
    prefsSettled: true,
    anyWelcomeOpen: false,
    embedMode: false,
    can: { level: 'edit' },
    activeTab: { id: 'tab1', elements: [sankey, square, stack] },
    userPreferences: {},
    setUserPreferences,
    writeUserPreferences,
    selfParticipant: { id: 'me' },
    sankeyFlowsOpenForId: null,
    setSankeyFlowsOpenForId,
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
  setActiveTour('show-me', false);
  setActiveTour('element', false);
  setStartPanelOpen(false);
  resetTourOffersForTests();
  setElementTourOffer(null);
});

describe('ElementTourHost offer', () => {
  it('offers the tour for a selected Sankey, and nothing for a square', () => {
    editor();
    mount();
    expect(elementTourOffer()).toBeNull();
    act(() => store.setSelectedId('sq1'));
    expect(elementTourOffer()).toBeNull();
    act(() => store.setSelectedId('sk1'));
    expect(elementTourOffer()).toMatchObject({ elementId: 'sk1', kind: 'sankey' });
    // Published once per page load as the Play button shows.
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'SankeyTourOffer');
    // Its X turns it down (Element Tours Declined).
    act(() => elementTourOffer()!.dismiss());
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'SankeyTourOffer');
    expect(writeUserPreferences).toHaveBeenCalledWith({ elementTourKinds: ['sankey'] }, 'me');
  });

  it.each([
    ['a Participant', { can: { level: 'participate' } }],
    ['a Viewer', { can: { level: 'view' } }],
    ['locked', { activeTab: { id: 'tab1', elements: [{ ...sankey, locked: true }] } }],
    ['not hydrated', { hydrated: false }],
    ['embedded', { embedMode: true }],
    ['under a welcome overlay', { anyWelcomeOpen: true }],
  ])('offers nothing when %s', (_why, over) => {
    editor(over);
    mount();
    act(() => store.setSelectedId('sk1'));
    expect(elementTourOffer()).toBeNull();
  });

  it('never offers a tour on a phone', () => {
    viewport.phone = true;
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    expect(elementTourOffer()).toBeNull();
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'SankeyTour');
  });

  it('makes no offer for a multi-selection', () => {
    editor();
    mount();
    act(() => store.setMultiSelectedIds(new Set(['sk1', 'sq1'])));
    expect(elementTourOffer()).toBeNull();
  });

  it('starts nothing while another tour is on screen', () => {
    editor();
    mount();
    act(() => setActiveTour('show-me', true));
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    expect(stage.engine?.active).toBe(false);
  });

  // Work Tracker #177: a taken element tour leaves the button; its Settings › Show Me switch brings it back.
  it('leaves the button once taken, and comes back when its Settings switch is on again', () => {
    editor({ userPreferences: { elementTourKinds: ['sankey'] } });
    const r = mount();
    act(() => store.setSelectedId('sk1'));
    expect(elementTourOffer()).toBeNull();
    editor({ userPreferences: { elementTourKinds: [] } });
    rerenderWith(r);
    expect(elementTourOffer()?.kind).toBe('sankey');
  });

  it('never starts on its own', () => {
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    expect(stage.engine?.active).toBe(false);
    expect(track).not.toHaveBeenCalledWith('UI', 'Started', 'SankeyTour');
  });
});

describe('ElementTourHost tour', () => {
  // Watching leaves the button, so the tour can be watched again; only its X takes it away (element-tours.md).
  it('a press starts on the first step and holds the tour slot, leaving the kind untaken', () => {
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    expect(writeUserPreferences).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'SankeyTour');
    expect(stage.engine?.active).toBe(true);
    expect(stage.engine?.step?.id).toBe('bands');
    expect(track).toHaveBeenCalledWith('UI', 'View', 'SankeyTourStepBands');
    expect(activeTour()).toBe('element');
  });

  it('opens the Flows dialog for its diagram on the dialog steps', async () => {
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    const seen: string[] = [];
    while (stage.engine?.active && !stage.engine.step?.id.startsWith('flows-')) {
      seen.push(stage.engine.step!.id);
      await act(async () => stage.engine!.next());
    }
    // The starter budget sends everything on (no leftover), and no More button is on screen here.
    expect(seen).toEqual(['bands', 'flows']);
    expect(stage.engine?.step?.id).toBe('flows-nodes');
    expect(setSankeyFlowsOpenForId).toHaveBeenCalledWith('sk1');
  });

  it('ends as skipped when its diagram is deleted', () => {
    editor();
    const r = mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    editor({ activeTab: { id: 'tab1', elements: [square] } });
    rerenderWith(r);
    expect(stage.engine?.active).toBe(false);
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyTourSkipped');
  });

  it('ends as skipped on another tab', () => {
    editor();
    const r = mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    editor({ activeTab: { id: 'tab2', elements: [sankey] } });
    rerenderWith(r);
    expect(stage.engine?.active).toBe(false);
  });

  it('Done completes it and puts the Flows dialog away', async () => {
    const close = vi.fn();
    const unregister = registerSankeyFlowsDialog({ showTable: vi.fn(), showText: vi.fn(), close });
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    while (stage.engine?.step?.card !== 'outro') await act(async () => stage.engine!.next());
    close.mockClear();
    await act(async () => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyTourCompleted');
    expect(activeTour()).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
    unregister();
  });

  it('Skip leaves the Flows dialog where it is', async () => {
    const close = vi.fn();
    const unregister = registerSankeyFlowsDialog({ showTable: vi.fn(), showText: vi.fn(), close });
    editor();
    mount();
    act(() => store.setSelectedId('sk1'));
    act(() => elementTourOffer()!.play());
    while (!stage.engine?.step?.id.startsWith('flows-'))
      await act(async () => stage.engine!.next());
    close.mockClear();
    act(() => stage.engine!.skip());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'SankeyTourSkipped');
    expect(close).not.toHaveBeenCalled();
    unregister();
  });
});

// A second toured kind runs through the same host, under its own token (docs/specs/007-editor/element-tours.md).
describe('ElementTourHost with a layer stack', () => {
  it('offers, plays and completes the Layer Stack tour under its own token', async () => {
    editor();
    mount();
    act(() => store.setSelectedId('ls1'));
    expect(elementTourOffer()).toMatchObject({ elementId: 'ls1', kind: 'layer-stack' });
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'LayerStackTourOffer');
    act(() => elementTourOffer()!.play());
    expect(writeUserPreferences).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'LayerStackTour');
    expect(stage.engine?.step?.id).toBe('layers');
    expect(track).toHaveBeenCalledWith('UI', 'View', 'LayerStackTourStepLayers');
    while (stage.engine?.active) await act(async () => stage.engine!.next());
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'LayerStackTourCompleted');
    // Nothing of the Sankey's is put away for a layer stack.
    expect(setSankeyFlowsOpenForId).not.toHaveBeenCalled();
  });
});
