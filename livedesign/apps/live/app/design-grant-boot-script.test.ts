// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESIGN_GRANT_BOOT_SCRIPT } from './pre-hydration-scripts';
import { thisBrowserKey } from '@liveworkspace/explorer/this-browser';

// The grant asked for before the editor's code loads (lib/api/design-grants.ts takeEarlyGrant): only for an address
// that names a design. A link's own address (`/design/shared?s=<code>`) names none, so the editor resolves the link
// first and nothing is asked here.
const run = (path: string) => {
  window.history.replaceState(null, '', path);
  // The script ships as text in the page head; running that text is the test.
  // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call
  new Function(DESIGN_GRANT_BOOT_SCRIPT)();
  return (window as { __ldesGrant?: { id: string; share: string } }).__ldesGrant;
};

describe('the design grant boot script', () => {
  afterEach(() => {
    (window as { __ldesGrant?: unknown }).__ldesGrant = undefined;
    vi.unstubAllGlobals();
  });

  it('asks for the grant on a design’s address, with the link it came in on', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    expect(run('/design/p1?s=CODE2345')).toMatchObject({ id: 'p1', share: 'CODE2345' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/index\/items\/p1\/grant$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('asks nothing on a link’s own address', () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(run('/design/shared?s=CODE2345')).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks nothing for an item this browser keeps only here: the index has never heard of it', () => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem(
      thisBrowserKey('livedesign'),
      JSON.stringify({ v: 1, items: [{ id: 'local1' }] }),
    );
    try {
      expect(run('/design/local1?s=CODE2345')).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      localStorage.clear();
    }
  });
});
