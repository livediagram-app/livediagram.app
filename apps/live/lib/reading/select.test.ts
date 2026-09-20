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
    const out = await read(crops, {});
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
    const out = await selectReader({ aiEnabled: false, ownerId: 'owner-1' }).read(crops, {});
    expect(readCropsInBrowser).toHaveBeenCalled();
    expect(out.get(0)).toEqual({ text: 'Machine Fixed', legible: true });
  });

  it('never sends a crop to the server when no model is configured', async () => {
    vi.mocked(readCropsInBrowser).mockResolvedValue(new Map());
    await selectReader({ aiEnabled: false, ownerId: 'owner-1' }).read(crops, {});
    expect(apiAiReadNotes).not.toHaveBeenCalled();
  });
});
