import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/ai', () => ({ apiAiReadNotes: vi.fn() }));
vi.mock('./browser-reader', () => ({ readCropsInBrowser: vi.fn() }));

import { apiAiReadNotes } from '@/lib/api/ai';
import { readCropsInBrowser } from './browser-reader';
import { selectReader } from './select';

// Which reader reads the handwriting (spec/139 Phase 9). A configured server
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
    vi.mocked(readCropsInBrowser).mockResolvedValue(
      new Map([[0, { text: 'Machine Fixed', legible: true }]]),
    );
    const { textById: out } = await selectReader({ aiEnabled: false, ownerId: 'owner-1' }).read(
      crops,
      {},
    );
    expect(readCropsInBrowser).toHaveBeenCalled();
    expect(out.get(0)).toEqual({ text: 'Machine Fixed', legible: true });
  });

  it('never sends a crop to the server when no model is configured', async () => {
    vi.mocked(readCropsInBrowser).mockResolvedValue(new Map());
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
