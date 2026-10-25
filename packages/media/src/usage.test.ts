import { describe, expect, it, vi } from 'vitest';
import { galleryUsage } from './usage';
import type { MediaUsage } from './wire';

// The Gallery's "Used in" map: every app's documents count, because the gallery lists every app's images.

const names: Record<string, string> = {
  'livediagram d1': 'Board',
  'livedocuments d2': 'Brief',
  'livedesign d3': 'Poster',
};
const name = async (app: string, document: string) => names[`${app} ${document}`] ?? null;

describe('galleryUsage', () => {
  it("names each image's documents in every app, by name, each once", async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'd2' },
        { app: 'livediagram.app', document: 'd1' },
        { app: 'livediagram.app', document: 'd1' },
      ],
      b: [{ app: 'livedesign.app', document: 'd3' }],
    };
    expect(await galleryUsage(usage, name)).toEqual({
      a: [
        { id: 'd1', name: 'Board', app: 'livediagram' },
        { id: 'd2', name: 'Brief', app: 'livedocuments' },
      ],
      b: [{ id: 'd3', name: 'Poster', app: 'livedesign' }],
    });
  });

  it('leaves out a document the caller cannot name, and an image left with none', async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'gone' },
        { app: 'livedocuments.app', document: 'd2' },
      ],
      b: [{ app: 'livediagram.app', document: 'thrown' }],
    };
    const failing = vi.fn(async (app: string, document: string) => {
      if (document === 'thrown') throw new Error('not_found');
      return name(app, document);
    });
    expect(await galleryUsage(usage, failing)).toEqual({
      a: [{ id: 'd2', name: 'Brief', app: 'livedocuments' }],
    });
  });

  it('keys a document by its app, so the same id in two apps is two documents', async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livediagram.app', document: 'x' },
        { app: 'livedocuments.app', document: 'x' },
      ],
    };
    const named = await galleryUsage(usage, async (app) => app);
    expect(named.a!.map((u) => u.app)).toEqual(['livediagram', 'livedocuments']);
  });

  it('names at most `max` documents, `inFlight` at a time', async () => {
    const usage: MediaUsage = {
      a: Array.from({ length: 50 }, (_, i) => ({
        app: 'livedocuments.app' as const,
        document: `d${i}`,
      })),
    };
    let running = 0;
    let most = 0;
    const slow = vi.fn(async (_app: string, document: string) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
      return document;
    });
    const named = await galleryUsage(usage, slow, { max: 20, inFlight: 4 });
    expect(slow).toHaveBeenCalledTimes(20);
    expect(most).toBeLessThanOrEqual(4);
    expect(named.a).toHaveLength(20);
  });
});
