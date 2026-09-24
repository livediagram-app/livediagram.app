// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('@/lib/reading/select', () => ({ selectReader: vi.fn() }));
vi.mock('@/lib/photo-detect', async () => {
  const actual = await vi.importActual<typeof import('@/lib/photo-detect')>('@/lib/photo-detect');
  return { ...actual, detectAndCrop: vi.fn() };
});

import { selectReader } from '@/lib/reading/select';

// The hook asks `selectReader` who reads; the tests drive that reader directly.
const readCrops = vi.fn();
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
    photoUrl: 'data:image/jpeg;base64,BBB',
    imageData: new Uint8ClampedArray(1000 * 1000 * 4),
    dropped: 0,
    detector: { path: 'classical', reason: 'no-worker' },
  };
}

// A reader's answer: the words, and — when a batch of the run failed — how
// many crops went unread and why.
function read(
  texts: { id: number; text: string; legible?: boolean }[],
  partial?: { unread: number; failure: string },
): {
  textById: Map<number, { text: string; legible: boolean }>;
  unread?: number;
  failure?: string;
} {
  const textById = new Map(texts.map((t) => [t.id, { text: t.text, legible: t.text !== '' }]));
  return partial ? { textById, ...partial } : { textById };
}

// The boxes the review would hand over: these detected ones, as detected.
function kept(
  h: { api: () => { review: { detection: PhotoDetection | null } | null } },
  ids: number[],
) {
  return (h.api().review?.detection?.stickies ?? []).filter((s) => ids.includes(s.id));
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

function harness(
  opts: { elements?: Element[]; createBlocked?: boolean; aiEnabled?: boolean } = {},
) {
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
      aiEnabled: opts.aiEnabled === true,
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

// jsdom implements neither half of the object-URL API, which the overlay uses
// to put the picked photograph on screen before anything has been decoded.
let revoked: string[] = [];
beforeEach(() => {
  revoked = [];
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${(n += 1)}`);
  URL.revokeObjectURL = vi.fn((url: string) => revoked.push(url));
  setPhotoDraftView(null);
  readCrops.mockReset();
  vi.mocked(selectReader).mockImplementation((deps) => ({
    kind: deps.aiEnabled ? 'server' : 'browser',
    read: readCrops,
  }));
  vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky()]));
  vi.mocked(readCrops).mockResolvedValue(read([{ id: 0, text: 'Order placed' }]));
});
afterEach(() => {
  cleanup();
  setPhotoDraftView(null);
  vi.clearAllMocks();
});

describe('which detector ran', () => {
  it('is counted once per photo, as a closed token', async () => {
    await reviewed();
    const calls = vi.mocked(track).mock.calls.filter((c) => String(c[2]).startsWith('PhotoDetect'));
    expect(calls).toEqual([['AI', 'Used', 'PhotoDetectClassicalNoWorker']]);
  });
});

async function reviewed(opts: Parameters<typeof harness>[0] = {}) {
  const h = harness(opts);
  await act(async () => {
    await h.api().startFromFile(file());
  });
  h.rerender();
  return h;
}

// Through the wizard to a landed draft: review, then confirm every box.
async function landed(opts: Parameters<typeof harness>[0] = {}) {
  const h = await reviewed(opts);
  const r = h.api().review;
  act(() => h.api().confirm(r?.detection?.stickies ?? [], r?.textById ?? new Map()));
  h.rerender();
  return h;
}

describe('the review wizard', () => {
  it('shows the review after reading, before anything lands', async () => {
    const h = await reviewed();
    expect(h.api().state.stage).toBe('review');
    expect(h.api().reviewOpen).toBe(true);
    expect(h.api().review?.detection?.stickies).toHaveLength(1);
    // The overlay draws the photo the author PICKED, which was on screen long
    // before the detector finished with it.
    expect(h.api().review?.photoUrl).toBeTruthy();
    expect(h.api().review?.textById.get(0)?.text).toBe('Order placed');
    // Nothing landed, no checkpoint armed: the review is a preview.
    expect(h.elements()).toEqual([]);
    expect(h.steps()).toBe(0);
  });

  it('walks idle → reading → review → draft, and only Add writes', async () => {
    const h = await reviewed();
    expect(h.api().state.stage).toBe('review');
    expect(h.elements()).toEqual([]);
    act(() => h.api().confirm(kept(h, [0]), h.api().review?.textById ?? new Map()));
    h.rerender();
    expect(h.api().state.stage).toBe('draft');
    expect(h.drafts()).toHaveLength(1);
    expect(h.api().draftOpen).toBe(true);
  });

  it('lands only the ticked boxes', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(readCrops).mockResolvedValue(
      read([
        { id: 0, text: 'Order placed' },
        { id: 1, text: 'Payment received' },
      ]),
    );
    const h = await reviewed();
    act(() => h.api().confirm(kept(h, [1]), h.api().review?.textById ?? new Map()));
    h.rerender();
    expect(h.drafts()).toHaveLength(1);
    expect((h.drafts()[0] as StickyElement).label).toBe('Payment received');
  });

  it('lands the boxes the author drew by hand, beside the detected ones', async () => {
    const h = await reviewed();
    const drawn = sticky({ id: -1, kind: 'command', x: 500, y: 500 });
    act(() => h.api().confirm([...kept(h, [0]), drawn], h.api().review?.textById ?? new Map()));
    h.rerender();
    expect(h.drafts()).toHaveLength(2);
    expect(
      h
        .drafts()
        .map((n) => (n as StickyElement).esKind)
        .sort(),
    ).toEqual(['command', 'domain-event']);
  });

  it('cancelReview leaves the board untouched and the import idle', async () => {
    const h = await reviewed();
    act(() => h.api().cancelReview());
    h.rerender();
    expect(h.api().state.stage).toBe('idle');
    expect(h.api().reviewOpen).toBe(false);
    expect(h.elements()).toEqual([]);
    expect(h.steps()).toBe(0);
  });

  it('refuses a second photo while the review is open', async () => {
    const h = await reviewed();
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(detectAndCrop).toHaveBeenCalledTimes(1);
    expect(h.api().state.stage).toBe('review');
  });
});

describe('landing a draft', () => {
  it('puts the notes on the board after confirm', async () => {
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

  it('keeps the words that DID arrive when part of the run failed', async () => {
    // The operator's hundred-note wall: one batch of the run answered 429 and
    // every box on the photograph read "Type the words…", including the ones
    // already read. What is lost is one batch, and the note that says so
    // counts it rather than claiming the reader gave up.
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(readCrops).mockResolvedValue(
      read([{ id: 0, text: 'Order placed' }], { unread: 1, failure: 'ai_quota' }),
    );
    const h = await reviewed();
    expect(h.api().review?.textById.get(0)?.text).toBe('Order placed');
    expect(h.api().review?.readError).toBe('partial:1');
    expect(h.toasts.at(-1)).toContain('1 notes could not be read');
  });

  it('selects the batch, so the author can see what arrived', async () => {
    const h = await landed();
    expect(h.selection()).toEqual(new Set(h.drafts().map((n) => n.id)));
  });

  it('brings the draft into view, with the notes it was matched against', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(readCrops).mockResolvedValue(
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
    vi.mocked(readCrops).mockResolvedValue(
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
    vi.mocked(readCrops).mockResolvedValue(read([{ id: 0, text: 'Order plaeced' }]));
    await landed({ elements: [esNote('a', 'Order placed')] });
    expect(getPhotoDraftView()?.differences.get('a')).toBe('Order plaeced');
  });

  it('never touches a note already on the board', async () => {
    const existing = [esNote('a', 'Order placed')];
    const frozen = JSON.stringify(existing);
    vi.mocked(detectAndCrop).mockResolvedValue(detection([sticky(), sticky({ id: 1, x: 600 })]));
    vi.mocked(readCrops).mockResolvedValue(
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
    // The photo STAYS on screen (spec/139: the dialog stays open for another
    // try). The advice is about this photograph, and closing the dialog throws
    // away the thing the advice is about — along with the chance to draw the
    // boxes by hand.
    expect(h.api().reviewOpen).toBe(true);
    expect(h.api().review?.detection?.stickies).toEqual([]);
    // The detector already answered: spending a model call here would be
    // spending the operator's budget on a picture of a wall.
    expect(readCrops).not.toHaveBeenCalled();
  });

  it('lands an unreadable crop as an EMPTY note — the paper was there', async () => {
    vi.mocked(readCrops).mockResolvedValue(read([{ id: 0, text: '', legible: false }]));
    const h = await landed();
    expect(h.drafts()).toHaveLength(1);
    expect((h.drafts()[0] as StickyElement).label).toBe('');
    expect((h.drafts()[0] as StickyElement).esKind).toBe('domain-event');
  });

  it('shows the review BLANK and says why when the read fails', async () => {
    vi.mocked(readCrops).mockRejectedValue(new Error('ai_quota'));
    const h = await reviewed();
    // The detector's work is not thrown away: the boxes are in the review,
    // blank, and the author can type the words themselves.
    expect(h.api().state.stage).toBe('review');
    expect(h.api().review?.readError).toBe('ai_quota');
    expect(h.api().review?.textById.size).toBe(0);
    expect(h.elements()).toEqual([]);
    expect(h.toasts[0]).toMatch(/quota/i);
  });

  it('still keeps the blank draft through Add after a failed read', async () => {
    vi.mocked(readCrops).mockRejectedValue(new Error('ai_error'));
    const h = await reviewed();
    act(() => h.api().confirm(kept(h, [0]), h.api().review?.textById ?? new Map()));
    h.rerender();
    act(() => h.api().accept());
    expect(h.drafts()).toHaveLength(0);
    expect(h.elements()).toHaveLength(1);
  });

  it('names HEIC before it ever calls the model', async () => {
    vi.mocked(detectAndCrop).mockRejectedValue(new PhotoDetectFailed('photo_unsupported_heic'));
    const h = await landed();
    expect(h.toasts[0]).toMatch(/HEIC/);
    expect(readCrops).not.toHaveBeenCalled();
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
    vi.mocked(readCrops).mockImplementation(async (_crops, opts) => {
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
    vi.mocked(readCrops).mockResolvedValue(read([{ id: 0, text: 'Payment received' }]));
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

// WHO reads is decided by what the deployment has, not by the author (spec/139
// Phase 9). The hook must pass the capability through and use whatever reader
// comes back — the import works either way.
describe('choosing the reader', () => {
  it('asks for the server reader when the api reports a model', async () => {
    const h = harness({ aiEnabled: true });
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(selectReader).toHaveBeenCalledWith(
      expect.objectContaining({ aiEnabled: true, ownerId: 'owner-1' }),
    );
    expect(readCrops).toHaveBeenCalled();
  });

  it('asks for the in-browser reader when no model is configured', async () => {
    const h = harness();
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(selectReader).toHaveBeenCalledWith(expect.objectContaining({ aiEnabled: false }));
    expect(readCrops).toHaveBeenCalled();
  });
});

// The photo goes up FIRST (spec/139 Phase 9). Detection is fast on a small
// photo and slow on a 12-megapixel one, and the first version did all of it
// before showing anything at all — so picking a big photo looked exactly like
// picking no photo: no overlay, no spinner, no error, nothing. The overlay now
// opens on the pick, with the photograph in it, and the finding happens behind
// it where it can be seen happening.
describe('the photo is on screen before the detector runs', () => {
  it('opens the review with the photo while detection is still going', async () => {
    let finish: (d: PhotoDetection) => void = () => {};
    vi.mocked(detectAndCrop).mockReturnValue(
      new Promise<PhotoDetection>((resolve) => {
        finish = resolve;
      }),
    );
    const h = harness();
    await act(async () => {
      void h.api().startFromFile(file());
      // Let the pick settle, but do NOT let detection finish.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(h.api().reviewOpen).toBe(true);
    expect(h.api().review?.photoUrl).toBeTruthy();
    // Nothing found YET: the overlay knows it is still looking.
    expect(h.api().review?.detection).toBeNull();

    await act(async () => {
      finish(detection([sticky()]));
      // Past the paint yield the hook takes before it starts detecting.
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(h.api().review?.detection?.stickies).toHaveLength(1);
  });

  it('hands the photograph back to the browser when the review closes', async () => {
    const h = await reviewed();
    const url = h.api().review!.photoUrl;
    act(() => h.api().cancelReview());
    // An object URL nobody revokes pins the whole photo in memory for the life
    // of the tab, and a wall photo is megabytes.
    expect(revoked).toContain(url);
  });

  it('closes the review and says why when the photo cannot be read', async () => {
    vi.mocked(detectAndCrop).mockRejectedValue(new PhotoDetectFailed('photo_unreadable'));
    const h = harness();
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(h.api().reviewOpen).toBe(false);
    expect(h.toasts.join(' ')).toMatch(/could not be opened/i);
  });

  it('keeps the photo up and says so when nothing was found', async () => {
    vi.mocked(detectAndCrop).mockResolvedValue(detection([]));
    const h = harness();
    await act(async () => {
      await h.api().startFromFile(file());
    });
    // The photo stays on screen: "no stickies" is advice about THIS photo, and
    // closing the dialog throws away the thing the advice is about.
    expect(h.api().reviewOpen).toBe(true);
    expect(h.api().review?.detection?.stickies).toHaveLength(0);
    expect(h.toasts.join(' ')).toMatch(/no stickies found/i);
  });
});

// Picking a photo must ALWAYS answer. The first version returned silently when
// an import was already open or a draft was still on the board, so the author
// picked a file and got nothing at all — no overlay, no message — and the only
// available theory was "the button is broken". Every refusal says why.
describe('a pick is never silently dropped', () => {
  it('says why when an import is already open', async () => {
    const h = await reviewed();
    h.toasts.length = 0;
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(h.toasts.join(' ')).toMatch(/already|finish/i);
  });

  it('says why when a draft is still waiting on the board', async () => {
    const h = await landed();
    h.toasts.length = 0;
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(h.toasts.join(' ')).toMatch(/already|finish/i);
  });

  it('says why when the board cannot take new notes at all', async () => {
    const h = harness({ createBlocked: true });
    await act(async () => {
      await h.api().startFromFile(file());
    });
    expect(h.toasts.length).toBeGreaterThan(0);
  });
});
