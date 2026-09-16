// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadNotesResponse } from '@livediagram/api-schema';
import {
  acceptDraft,
  discardDraft,
  type Element,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { getPhotoDraftView, setPhotoDraftView } from '@/lib/photo-draft-preview';
import { usePhotoDraft } from './usePhotoDraft';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));
vi.mock('@/lib/api/ai', () => ({ apiAiReadNotes: vi.fn() }));
vi.mock('@/lib/photo-detect', async () => {
  const actual = await vi.importActual<typeof import('@/lib/photo-detect')>('@/lib/photo-detect');
  return { ...actual, detectAndCrop: vi.fn() };
});

import { apiAiReadNotes } from '@/lib/api/ai';
import { detectAndCrop, PhotoDetectFailed, type PhotoDetection } from '@/lib/photo-detect';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { track } from '@/lib/telemetry';

// A photo import as ONE gesture (spec/139 Phase 8): the draft lands in the
// document so the author can correct it with the ordinary machinery, Add
// leaves exactly one undo step, and Discard leaves the board byte-for-byte as
// it was.

// What the DETECTOR found (geometry + kind), and what the model READ (words).
// The hybrid's whole shape is that these are two different answers.
function sticky(over: Partial<DetectedSticky> = {}): DetectedSticky {
  return {
    id: 0,
    kind: 'domain-event' as const,
    size: 'square' as const,
    x: 100,
    y: 100,
    w: 100,
    h: 100,
    row: 0,
    order: 0,
    confidence: 0.95,
    ...over,
  };
}

function detection(stickies: DetectedSticky[]): PhotoDetection {
  return {
    stickies,
    crops: stickies.map((s) => ({ id: s.id, image: 'data:image/jpeg;base64,AAA' })),
    imageSize: { width: 1000, height: 1000 },
  };
}

function read(texts: { id: number; text: string; legible?: boolean }[]): ReadNotesResponse {
  return { texts: texts.map((t) => ({ legible: t.text !== '', ...t })) };
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
  let elements = opts.elements ?? [];
  // The editor's real history semantics, minimally: a checkpoint pushes a
  // snapshot, ticks mutate without one, cancel restores and pops.
  const snapshots: Element[][] = [];
  const logged: { before: Element[]; after: Element[] }[] = [];
  const toasts: string[] = [];
  const framed: { x: number; y: number; w: number; h: number }[] = [];
  let selection = new Set<string>();

  const view = renderHook(() =>
    usePhotoDraft({
      get activeTab() {
        return { id: 't1', name: 'Wall', kind: 'event-storming', elements } as Tab;
      },
      activeId: 't1',
      ownerId: 'owner-1',
      createBlocked: opts.createBlocked === true,
      tick: (map) => {
        elements = map(elements);
      },
      markCheckpoint: () => {
        snapshots.push(elements);
        return snapshots.length;
      },
      cancelToCheckpoint: () => {
        elements = snapshots.pop() ?? elements;
      },
      emitChange: (_tabId, before, after) => logged.push({ before, after }),
      setSelectedId: () => {},
      setMultiSelectedIds: (ids) => {
        selection = ids;
      },
      fitToBounds: (bbox) => framed.push(bbox),
      toastError: (m) => toasts.push(m),
    }),
  );

  return {
    api: () => view.result.current,
    elements: () => elements,
    drafts: () => elements.filter((el) => (el as StickyElement).esDraft === true),
    steps: () => snapshots.length,
    undoOnce: () => {
      elements = snapshots.pop() ?? elements;
    },
    logged,
    toasts,
    selection: () => selection,
    framed,
    rerender: () => view.rerender(),
  };
}

const file = () => new File([new Uint8Array([1])], 'wall.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  setPhotoDraftView(null);
  vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky()]));
  vi.mocked(apiAiReadNotes).mockResolvedValue(read([{ id: 0, text: 'Order placed' }]));
});
afterEach(() => {
  cleanup();
  setPhotoDraftView(null);
  vi.clearAllMocks();
});

async function landed(opts: Parameters<typeof harness>[0] = {}) {
  const h = harness(opts);
  await act(async () => {
    await h.api().startFromFile(file());
  });
  h.rerender();
  return h;
}

describe('landing a draft', () => {
  it('walks idle → reading → draft and puts the notes on the board', async () => {
    const h = await landed();
    expect(h.api().state.stage).toBe('draft');
    expect(h.drafts()).toHaveLength(1);
    expect(h.api().draftOpen).toBe(true);
  });

  it('mints each note through the ONE builder, flagged as a draft', async () => {
    const h = await landed();
    const note = h.drafts()[0] as StickyElement;
    expect(note).toMatchObject({
      type: 'sticky',
      esKind: 'domain-event',
      label: 'Order placed',
      esDraft: true,
      fixedSize: true,
      textSize: 'scale',
      fillColor: '#fdba74',
      width: 200,
      height: 200,
    });
    expect(Math.abs(note.rotation ?? 0)).toBeLessThanOrEqual(1.1);
  });

  it('arms exactly one checkpoint and writes the notes as a tick', async () => {
    const h = await landed();
    expect(h.steps()).toBe(1);
    // …and the one snapshot is the board BEFORE the draft landed.
    h.undoOnce();
    expect(h.elements()).toEqual([]);
  });

  it('selects the batch, so the author can see what arrived', async () => {
    const h = await landed();
    expect(h.selection()).toEqual(new Set(h.drafts().map((n) => n.id)));
  });

  it('brings the draft into view, with the notes it was matched against', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(apiAiReadNotes).mockResolvedValue(
      read([
        { id: 0, text: 'Order placed' },
        { id: 1, text: 'Payment received' },
      ]),
    );
    const h = await landed({ elements: [esNote('a', 'Order placed', 4000)] });
    // An import that lands off-screen reads as an import that did nothing.
    expect(h.framed).toHaveLength(1);
    const box = h.framed[0]!;
    const draft = h.drafts()[0] as StickyElement;
    expect(box.x).toBeLessThanOrEqual(Math.min(draft.x, 4000));
    expect(box.x + box.w).toBeGreaterThanOrEqual(Math.max(draft.x + draft.width, 4200));
  });

  it('publishes what the photo matched, for the fade and the badges', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(apiAiReadNotes).mockResolvedValue(
      read([
        { id: 0, text: 'Order placed' },
        { id: 1, text: 'Payment received' },
      ]),
    );
    const h = await landed({ elements: [esNote('a', 'Order placed')] });
    expect(getPhotoDraftView()?.matchedIds).toEqual(new Set(['a']));
    expect(getPhotoDraftView()?.read).toBe(2);
    expect(h.drafts()).toHaveLength(1);
  });

  it('records what the photo read when it differs from the board', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue(read([{ id: 0, text: 'Order plaeced' }]));
    await landed({ elements: [esNote('a', 'Order placed')] });
    expect(getPhotoDraftView()?.differences.get('a')).toBe('Order plaeced');
  });

  it('never touches a note already on the board', async () => {
    const existing = [esNote('a', 'Order placed')];
    const frozen = JSON.stringify(existing);
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(apiAiReadNotes).mockResolvedValue(
      read([
        { id: 0, text: 'Order placed' },
        { id: 1, text: 'Payment received' },
      ]),
    );
    const h = await landed({ elements: existing });
    expect(JSON.stringify(h.elements().filter((el) => el.id === 'a'))).toBe(frozen);
  });

  it('says so, and never calls the model, when there is no paper in the photo', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([]));
    const h = await landed();
    expect(h.elements()).toEqual([]);
    expect(h.steps()).toBe(0);
    expect(h.toasts[0]).toMatch(/no stickies found/i);
    expect(h.api().state.stage).toBe('idle');
    // The detector already answered: spending a model call here would be
    // spending the operator's budget on a picture of a wall.
    expect(apiAiReadNotes).not.toHaveBeenCalled();
  });

  it('lands an unreadable crop as an EMPTY note — the paper was there', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue(read([{ id: 0, text: '', legible: false }]));
    const h = await landed();
    expect(h.drafts()).toHaveLength(1);
    expect((h.drafts()[0] as StickyElement).label).toBe('');
    expect((h.drafts()[0] as StickyElement).esKind).toBe('domain-event');
  });

  it('toasts the failure and lands nothing when the read fails', async () => {
    vi.mocked(apiAiReadNotes).mockRejectedValue(new Error('ai_not_configured'));
    const h = await landed();
    expect(h.toasts[0]).toMatch(/not enabled on this deployment/i);
    expect(h.elements()).toEqual([]);
  });

  it('names HEIC before it ever calls the model', async () => {
    vi.mocked(detectAndCrop).mockRejectedValue(new PhotoDetectFailed('photo_unsupported_heic'));
    const h = await landed();
    expect(h.toasts[0]).toMatch(/HEIC/);
    expect(apiAiReadNotes).not.toHaveBeenCalled();
  });

  it('refuses in a read-only / locked session', async () => {
    const h = await landed({ createBlocked: true });
    expect(detectAndCrop).not.toHaveBeenCalled();
    expect(h.elements()).toEqual([]);
  });

  it('refuses a second photo while a draft is open', async () => {
    const h = await landed();
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(h.drafts()).toHaveLength(1);
  });

  it('treats a cancel as a change of mind, not a failure', async () => {
    vi.mocked(apiAiReadNotes).mockImplementation(async (_owner, _crops, opts) => {
      await new Promise((r) => setTimeout(r, 5));
      if (opts?.signal?.aborted) throw new Error('aborted');
      return read([{ id: 0, text: 'Order placed' }]);
    });
    const h = harness();
    let pending: Promise<void>;
    act(() => {
      pending = h.api().startFromFile(file());
    });
    act(() => h.api().cancelReading());
    await act(async () => {
      await pending!;
    });
    expect(h.elements()).toEqual([]);
    expect(h.toasts).toEqual([]);
    expect(h.api().state.stage).toBe('idle');
  });
});

describe('correcting the draft, then Add', () => {
  it('accepts by dropping the flag, leaving one history step behind', async () => {
    const h = await landed();
    act(() => h.api().accept());
    expect(h.drafts()).toHaveLength(0);
    expect(h.elements()).toHaveLength(1);
    expect(h.steps()).toBe(1);
    // One Undo takes the whole import back.
    h.undoOnce();
    expect(h.elements()).toEqual([]);
  });

  it('reports the import once, and each note added', async () => {
    const h = await landed();
    act(() => h.api().accept());
    expect(vi.mocked(track).mock.calls.filter((c) => c[2] === 'PhotoNotes')).toHaveLength(1);
    expect(vi.mocked(track).mock.calls.filter((c) => c[1] === 'Added')).toHaveLength(1);
  });

  it('logs the import as one activity entry', async () => {
    const h = await landed();
    act(() => h.api().accept());
    expect(h.logged).toHaveLength(1);
    expect(h.logged[0]!.before).toEqual([]);
    expect(h.logged[0]!.after).toHaveLength(1);
  });

  it('clears the session view state on the way out', async () => {
    const h = await landed();
    act(() => h.api().accept());
    expect(getPhotoDraftView()).toBeNull();
    expect(h.api().draftOpen).toBe(false);
  });
});

describe('Discard', () => {
  it('leaves the board byte-for-byte as it was', async () => {
    const existing = [esNote('a', 'Order placed', 900)];
    const frozen = JSON.stringify(existing);
    vi.mocked(apiAiReadNotes).mockResolvedValue(read([{ id: 0, text: 'Payment received' }]));
    const h = await landed({ elements: existing });
    expect(h.drafts()).toHaveLength(1);
    act(() => h.api().discard());
    expect(JSON.stringify(h.elements())).toBe(frozen);
    expect(getPhotoDraftView()).toBeNull();
  });

  it('leaves no trace in the undo stack', async () => {
    const h = await landed();
    act(() => h.api().discard());
    expect(h.steps()).toBe(0);
    expect(h.logged).toEqual([]);
  });

  it('removes a draft that outlived its session, as an ordinary edit', () => {
    // No checkpoint to go back to (a reload): the notes are still drafts, and
    // Discard has to be able to clear them anyway.
    const h = harness({
      elements: [esNote('a', 'Kept'), { ...esNote('d', 'Draft'), esDraft: true } as Element],
    });
    act(() => h.api().discard());
    expect(h.elements().map((el) => el.id)).toEqual(['a']);
  });
});

describe('the pure lifecycle the hook leans on', () => {
  it('accept and discard are the two ends of it', () => {
    const board: Element[] = [
      esNote('a', 'Kept'),
      { ...esNote('d', 'Draft'), esDraft: true } as Element,
    ];
    expect(acceptDraft(board).every((el) => (el as StickyElement).esDraft === undefined)).toBe(
      true,
    );
    expect(discardDraft(board).map((el) => el.id)).toEqual(['a']);
  });
});
