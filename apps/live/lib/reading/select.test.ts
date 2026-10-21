import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/ai', () => ({ apiAiReadNotes: vi.fn() }));
vi.mock('./browser-reader', () => ({ readCropsInBrowser: vi.fn() }));

import { apiAiReadNotes } from '@/lib/api/ai';
import { readCropsInBrowser } from './browser-reader';
import { selectReader } from './select';

// Which reader reads the handwriting (docs/specs/021-event-storming/event-storming.md Phase 9). A configured server
// model is far more accurate than anything that fits in a browser download, so
// it wins when there is one; without it the in-browser model reads, and the
// import still works with no key at all.

const crops = [{ id: 0, image: 'data:image/jpeg;base64,AAA' }];

describe('selectReader', () => {
  afterEach(() => vi.clearAllMocks());

  it('reads through the server when the api reports a model', () => {
    expect(selectReader({ aiEnabled: true, ownerId: 'owner-1' }).kind).toBe('server');
  });

  it('reads in the browser when no model is configured', () => {
    expect(selectReader({ aiEnabled: false, ownerId: 'owner-1' }).kind).toBe('browser');
  });

  it('hands the server answer back keyed by crop id', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({
      texts: [
        { id: 0, text: 'Course Created', legible: true },
        { id: 1, text: '', legible: false },
      ],
    });
    const { read } = selectReader({ aiEnabled: true, ownerId: 'owner-1' });
    const { textById: out } = await read(crops, {});
    expect(out.get(0)).toEqual({ text: 'Course Created', legible: true });
    expect(out.get(1)).toEqual({ text: '', legible: false });
  });

  it('passes the owner, signal and progress through to the server reader', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({ texts: [] });
    const controller = new AbortController();
    const onProgress = vi.fn();
    await selectReader({ aiEnabled: true, ownerId: 'owner-7' }).read(crops, {
      signal: controller.signal,
      onProgress,
    });
    expect(apiAiReadNotes).toHaveBeenCalledWith(
      'owner-7',
      crops,
      expect.objectContaining({ signal: controller.signal, onProgress }),
    );
  });

  it('delegates to the in-browser model when there is no server model', async () => {
    vi.mocked(readCropsInBrowser).mockResolvedValue({
      textById: new Map([[0, { text: 'Machine Fixed', legible: true }]]),
    });
    const { textById: out } = await selectReader({ aiEnabled: false, ownerId: 'owner-1' }).read(
      crops,
      {},
    );
    expect(readCropsInBrowser).toHaveBeenCalled();
    expect(out.get(0)).toEqual({ text: 'Machine Fixed', legible: true });
  });

  it('never sends a crop to the server when no model is configured', async () => {
    vi.mocked(readCropsInBrowser).mockResolvedValue({ textById: new Map() });
    await selectReader({ aiEnabled: false, ownerId: 'owner-1' }).read(crops, {});
    expect(apiAiReadNotes).not.toHaveBeenCalled();
  });
});

// Both readers must hand the app the SAME shape. A sticky's line break is
// layout, not content: the model returns "Machine\nFixed" for two lines of
// marker, and a single-line field renders that as "MachineFixed" — the words
// welded together. The note wraps to its own width on the canvas anyway, so a
// newline is a space everywhere the text is used.
describe('whitespace is normalised whoever read it', () => {
  it('turns the line breaks on a note into spaces', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({
      texts: [{ id: 0, text: 'Machine\nFixed', legible: true }],
    });
    const { textById: out } = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(crops, {});
    expect(out.get(0)!.text).toBe('Machine Fixed');
  });

  it('collapses runs of space and trims the edges', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({
      texts: [{ id: 0, text: '  Course   Schedule\n\n Updated \n', legible: true }],
    });
    const { textById: out } = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(crops, {});
    expect(out.get(0)!.text).toBe('Course Schedule Updated');
  });

  it('a note that is only whitespace is not legible', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({
      texts: [{ id: 0, text: '\n  \n', legible: true }],
    });
    const { textById: out } = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(crops, {});
    expect(out.get(0)).toEqual({ text: '', legible: false });
  });
});

// When the hosted reader's budget is spent, the notes it did not read are read
// HERE instead (docs/specs/021-event-storming/event-storming.md Phase 9), and the review is told so. Whose budget it
// was is not the reader's business, and not said.
describe('when the free budget is spent', () => {
  const two = [
    { id: 0, image: 'data:image/jpeg;base64,AAA' },
    { id: 1, image: 'data:image/jpeg;base64,BBB' },
  ];
  afterEach(() => vi.clearAllMocks());

  it('reads every note on this device when no batch was read', async () => {
    vi.mocked(apiAiReadNotes).mockRejectedValue(new Error('ai_quota'));
    vi.mocked(readCropsInBrowser).mockResolvedValue({
      textById: new Map([
        [0, { text: 'Order placed', legible: true }],
        [1, { text: 'Paid', legible: true }],
      ]),
    });
    const onFallback = vi.fn();
    const result = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(two, { onFallback });
    expect(readCropsInBrowser).toHaveBeenCalledWith(two, expect.anything());
    expect(onFallback).toHaveBeenCalledWith('budget');
    expect(result.fallback).toBe('budget');
    expect(result.failure).toBeUndefined();
    expect(result.textById.get(1)).toEqual({ text: 'Paid', legible: true });
  });

  it('keeps what the server read and reads only the rest here, carrying the count on', async () => {
    vi.mocked(apiAiReadNotes).mockResolvedValue({
      texts: [{ id: 0, text: 'Order placed', legible: true }],
      unread: 1,
      failure: 'ai_quota',
    });
    vi.mocked(readCropsInBrowser).mockImplementation(async (_crops, opts) => {
      opts?.onProgress?.(1);
      return { textById: new Map([[1, { text: 'Paid', legible: true }]]) };
    });
    const onProgress = vi.fn();
    const result = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(two, { onProgress });
    expect(readCropsInBrowser).toHaveBeenCalledWith([two[1]], expect.anything());
    // One read by the server, one here: the bar says two, not one.
    expect(onProgress).toHaveBeenLastCalledWith(2);
    expect(result.textById.get(0)).toEqual({ text: 'Order placed', legible: true });
    expect(result.textById.get(1)).toEqual({ text: 'Paid', legible: true });
    expect(result.fallback).toBe('budget');
  });

  it('says the device reader could not start when it cannot', async () => {
    vi.mocked(apiAiReadNotes).mockRejectedValue(new Error('ai_quota'));
    vi.mocked(readCropsInBrowser).mockResolvedValue({
      textById: new Map([
        [0, { text: '', legible: false }],
        [1, { text: '', legible: false }],
      ]),
      failure: 'reader_unavailable',
      detail: 'blocked CDN',
    });
    const result = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(two, {});
    expect(result.fallback).toBe('budget');
    expect(result.failure).toBe('reader_unavailable');
    expect(result.detail).toBe('blocked CDN');
  });

  it('does not fail over for any other server failure', async () => {
    vi.mocked(apiAiReadNotes).mockRejectedValue(new Error('ai_error'));
    await expect(selectReader({ aiEnabled: true, ownerId: 'o' }).read(two, {})).rejects.toThrow(
      'ai_error',
    );
    expect(readCropsInBrowser).not.toHaveBeenCalled();
  });

  it('never mentions a budget on a keyless deployment', async () => {
    vi.mocked(readCropsInBrowser).mockResolvedValue({ textById: new Map() });
    const onFallback = vi.fn();
    const result = await selectReader({ aiEnabled: false, ownerId: 'o' }).read(two, { onFallback });
    expect(onFallback).not.toHaveBeenCalled();
    expect(result.fallback).toBeUndefined();
  });
});
