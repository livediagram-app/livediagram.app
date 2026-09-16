// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhotoNotesResponse } from '@livediagram/api-schema';
import type { Element, StickyElement, Tab } from '@livediagram/diagram';
import { usePhotoImport } from './usePhotoImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));
vi.mock('@/lib/api/ai', () => ({ apiAiPhotoNotes: vi.fn() }));
vi.mock('@/lib/photo-prepare', async () => {
  const actual = await vi.importActual<typeof import('@/lib/photo-prepare')>('@/lib/photo-prepare');
  return { ...actual, preparePhoto: vi.fn() };
});

import { apiAiPhotoNotes } from '@/lib/api/ai';
import { preparePhoto, PhotoPrepareFailed } from '@/lib/photo-prepare';
import { track } from '@/lib/telemetry';

// The import RUN (spec/139 Phase 8): what it does at each step, what it
// commits, and — the load-bearing one — that a note already on the board is
// never touched by any of it.

const PHOTO = { dataUrl: 'data:image/jpeg;base64,AAA', width: 1000, height: 700 };

function detected(over: Partial<PhotoNotesResponse['notes'][number]> = {}) {
  return {
    id: 1,
    text: 'Order placed',
    kind: 'domain-event' as const,
    colour: '#fdba74',
    size: 'square' as const,
    cx: 0.2,
    cy: 0.2,
    w: 0.1,
    h: 0.1,
    row: 0,
    order: 0,
    confidence: 0.9,
    ...over,
  };
}

function esNote(id: string, label: string, x = 0): StickyElement {
  return {
    id,
    type: 'sticky',
    esKind: 'domain-event',
    fixedSize: true,
    label,
    x,
    y: 0,
    width: 200,
    height: 200,
  } as StickyElement;
}

function harness(opts: { elements?: Element[]; createBlocked?: boolean } = {}) {
  let tabs: Tab[] = [
    {
      id: 't1',
      name: 'Wall',
      kind: 'event-storming',
      elements: opts.elements ?? [],
    } as Tab,
  ];
  let selected = new Set<string>();
  const view = renderHook(() =>
    usePhotoImport({
      get activeTab() {
        return tabs[0]!;
      },
      activeId: 't1',
      ownerId: 'owner-1',
      createBlocked: opts.createBlocked === true,
      commitTabs: (map) => {
        tabs = map(tabs);
        return 1;
      },
      setMultiSelectedIds: (ids) => {
        selected = ids;
      },
    }),
  );
  return {
    api: () => view.result.current,
    state: () => view.result.current.state,
    elements: () => tabs[0]!.elements,
    selected: () => selected,
  };
}

const file = (type = 'image/jpeg') => new File([new Uint8Array([1])], 'wall.jpg', { type });

beforeEach(() => {
  vi.mocked(preparePhoto).mockResolvedValue(PHOTO);
  vi.mocked(apiAiPhotoNotes).mockResolvedValue({ wall: true, notes: [detected()] });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('reading a photo', () => {
  it('walks idle → reading → review', async () => {
    const h = harness();
    expect(h.state().stage).toBe('idle');
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state().stage).toBe('review');
    expect(h.state().photo).toEqual(PHOTO);
    expect(h.state().reconciliation!.additions).toHaveLength(1);
    // Everything found is ticked: the common answer is "yes, all of them".
    expect([...h.state().included]).toEqual([1]);
  });

  it('stops at the prepare step when the file is not a photo we can read', async () => {
    vi.mocked(preparePhoto).mockRejectedValue(new PhotoPrepareFailed('photo_unsupported_heic'));
    const h = harness();
    await act(async () => {
      await h.api().read(file('image/heic'));
    });
    expect(h.state()).toMatchObject({ stage: 'error', error: 'photo_unsupported_heic' });
    expect(apiAiPhotoNotes).not.toHaveBeenCalled();
  });

  it('surfaces the route’s own token when the read fails', async () => {
    vi.mocked(apiAiPhotoNotes).mockRejectedValue(new Error('ai_not_configured'));
    const h = harness();
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state()).toMatchObject({ stage: 'error', error: 'ai_not_configured' });
  });

  it('retries cleanly after a failure', async () => {
    vi.mocked(apiAiPhotoNotes).mockRejectedValueOnce(new Error('ai_error'));
    const h = harness();
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state().stage).toBe('error');
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state()).toMatchObject({ stage: 'review', error: null });
  });

  it('treats an abort as a change of mind, not a failure', async () => {
    vi.mocked(apiAiPhotoNotes).mockImplementation(async (_o, _i, _t, opts) => {
      await new Promise((r) => setTimeout(r, 5));
      if (opts?.signal?.aborted) throw new Error('aborted');
      return { wall: true, notes: [] };
    });
    const h = harness();
    let pending: Promise<void>;
    act(() => {
      pending = h.api().read(file());
    });
    act(() => h.api().reset());
    await act(async () => {
      await pending!;
    });
    expect(h.state().stage).toBe('idle');
    expect(h.state().error).toBeNull();
  });

  it('carries "this is not a wall" into the review as the empty state', async () => {
    vi.mocked(apiAiPhotoNotes).mockResolvedValue({ wall: false, notes: [], hint: 'A cat.' });
    const h = harness();
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state().stage).toBe('review');
    expect(h.state().response!.wall).toBe(false);
  });
});

describe('committing what the review says', () => {
  async function reviewed(opts: Parameters<typeof harness>[0] = {}) {
    const h = harness(opts);
    await act(async () => {
      await h.api().read(file());
    });
    return h;
  }

  it('adds the note, through the ONE builder', async () => {
    const h = await reviewed();
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    const added = h.elements()[0] as StickyElement;
    expect(added).toMatchObject({
      type: 'sticky',
      esKind: 'domain-event',
      label: 'Order placed',
      fixedSize: true,
      textSize: 'scale',
      width: 200,
      height: 200,
      fillColor: '#fdba74',
    });
    expect(Math.abs(added.rotation ?? 0)).toBeLessThanOrEqual(1.1);
    expect(h.selected()).toEqual(new Set([added.id]));
  });

  it('adds NOTHING that the review unticked', async () => {
    const h = await reviewed();
    act(() => h.api().setIncluded(1, false));
    act(() => h.api().commit());
    expect(h.elements()).toHaveLength(0);
    // Still in review: there was nothing to do, so nothing happened.
    expect(h.state().stage).toBe('review');
  });

  it('honours an edited text and an edited kind', async () => {
    const h = await reviewed();
    act(() => h.api().editNote(1, { text: 'Order accepted', kind: 'policy' }));
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    expect(h.elements()[0]).toMatchObject({
      label: 'Order accepted',
      esKind: 'policy',
      // The silhouette follows the corrected kind, not the read one.
      width: 300,
      height: 180,
    });
  });

  it('adds every included note in ONE step', async () => {
    vi.mocked(apiAiPhotoNotes).mockResolvedValue({
      wall: true,
      notes: [detected(), detected({ id: 2, text: 'Payment received', cx: 0.5, order: 1 })],
    });
    let commits = 0;
    let tabs: Tab[] = [{ id: 't1', name: 'Wall', kind: 'event-storming', elements: [] } as Tab];
    const view = renderHook(() =>
      usePhotoImport({
        get activeTab() {
          return tabs[0]!;
        },
        activeId: 't1',
        ownerId: 'o',
        createBlocked: false,
        commitTabs: (map) => {
          commits += 1;
          tabs = map(tabs);
          return 1;
        },
        setMultiSelectedIds: () => {},
      }),
    );
    await act(async () => {
      await view.result.current.read(file());
    });
    act(() => view.result.current.commit());
    await waitFor(() => expect(view.result.current.state.stage).toBe('done'));
    expect(commits).toBe(1);
    expect(tabs[0]!.elements).toHaveLength(2);
  });

  it('never touches a note that is already on the board', async () => {
    const existing = [esNote('a', 'Order placed')];
    const frozen = JSON.stringify(existing);
    vi.mocked(apiAiPhotoNotes).mockResolvedValue({
      wall: true,
      notes: [detected(), detected({ id: 2, text: 'Payment received', cx: 0.6, order: 1 })],
    });
    const h = await reviewed({ elements: existing });
    expect(h.state().reconciliation!.matches).toHaveLength(1);
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    expect(h.elements()).toHaveLength(2);
    expect(JSON.stringify([h.elements()[0]])).toBe(frozen);
    expect((h.elements()[1] as StickyElement).label).toBe('Payment received');
  });

  it('reconciles again at COMMIT time, against the board as it now is', async () => {
    // A peer adds the very note the photo showed, while the author reads it.
    let tabs: Tab[] = [{ id: 't1', name: 'Wall', kind: 'event-storming', elements: [] } as Tab];
    const view = renderHook(() =>
      usePhotoImport({
        get activeTab() {
          return tabs[0]!;
        },
        activeId: 't1',
        ownerId: 'o',
        createBlocked: false,
        commitTabs: (map) => {
          tabs = map(tabs);
          return 1;
        },
        setMultiSelectedIds: () => {},
      }),
    );
    await act(async () => {
      await view.result.current.read(file());
    });
    tabs = [{ ...tabs[0]!, elements: [esNote('peer', 'Order placed')] }];
    act(() => view.result.current.commit());
    // Nothing to add any more: the peer's note matches, so the run does not
    // duplicate it.
    expect(tabs[0]!.elements).toHaveLength(1);
  });

  it('refuses in a read-only / locked session', async () => {
    const h = await reviewed({ createBlocked: true });
    act(() => h.api().commit());
    expect(h.elements()).toHaveLength(0);
  });

  it('reports the import once, and each note added', async () => {
    const h = await reviewed();
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    expect(vi.mocked(track).mock.calls.filter((c) => c[2] === 'PhotoNotes')).toHaveLength(1);
    expect(vi.mocked(track).mock.calls.filter((c) => c[1] === 'Added')).toHaveLength(1);
  });

  it('starts the next run against the board the last one left', async () => {
    const h = await reviewed();
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    act(() => h.api().again());
    expect(h.state()).toMatchObject({ stage: 'idle', response: null, addedCount: 0 });
    // …and the note it added is now ON the board, so a second read of the
    // same photo matches instead of duplicating.
    await act(async () => {
      await h.api().read(file());
    });
    expect(h.state().reconciliation!.additions).toHaveLength(0);
    expect(h.state().reconciliation!.matches).toHaveLength(1);
  });
});

describe('a docked pair from the photo', () => {
  it('arrives docked, pointing at the note it came in with', async () => {
    vi.mocked(apiAiPhotoNotes).mockResolvedValue({
      wall: true,
      notes: [
        detected({ id: 1, text: 'Place order', kind: 'command', cx: 0.2, cy: 0.5 }),
        detected({ id: 2, text: 'Order placed', kind: 'domain-event', cx: 0.31, cy: 0.5 }),
      ],
    });
    const h = harness();
    await act(async () => {
      await h.api().read(file());
    });
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    const command = h.elements().find((el) => (el as StickyElement).esKind === 'command') as
      StickyElement | undefined;
    const event = h.elements().find((el) => (el as StickyElement).esKind === 'domain-event');
    expect(command!.esDock).toEqual({ hostId: event!.id, side: 'before' });
  });

  it('leaves the relation off when the review unticks it', async () => {
    vi.mocked(apiAiPhotoNotes).mockResolvedValue({
      wall: true,
      notes: [
        detected({ id: 1, text: 'Place order', kind: 'command', cx: 0.2, cy: 0.5 }),
        detected({ id: 2, text: 'Order placed', kind: 'domain-event', cx: 0.31, cy: 0.5 }),
      ],
    });
    const h = harness();
    await act(async () => {
      await h.api().read(file());
    });
    act(() => h.api().editNote(1, { dock: false }));
    act(() => h.api().commit());
    await waitFor(() => expect(h.state().stage).toBe('done'));
    const command = h.elements().find((el) => (el as StickyElement).esKind === 'command') as
      StickyElement | undefined;
    expect(command!.esDock).toBeUndefined();
  });
});
