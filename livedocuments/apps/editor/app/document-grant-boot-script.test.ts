// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_GRANT_BOOT_SCRIPT } from './pre-hydration-scripts';
import { thisBrowserKey } from '@liveworkspace/explorer/this-browser';

// The grant asked for before the editor's code loads (lib/api/document-grants.ts takeEarlyGrant): only for an address
// that names a document. A link's own address (`/document/shared?s=<code>`) names none, so the editor resolves the link
// first and nothing is asked here.
const run = (path: string) => {
  window.history.replaceState(null, '', path);
  // The script ships as text in the page head; running that text is the test.
  // oxlint-disable-next-line typescript/no-implied-eval, typescript/no-unsafe-call
  new Function(DOCUMENT_GRANT_BOOT_SCRIPT)();
  return (window as { __ldocGrant?: { id: string; share: string } }).__ldocGrant;
};

describe('the document grant boot script', () => {
  afterEach(() => {
    (window as { __ldocGrant?: unknown }).__ldocGrant = undefined;
    vi.unstubAllGlobals();
  });

  it('asks for the grant on a document’s address, with the link it came in on', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    expect(run('/document/p1?s=CODE2345')).toMatchObject({ id: 'p1', share: 'CODE2345' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/index\/items\/p1\/grant$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('asks nothing on a link’s own address', () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(run('/document/shared?s=CODE2345')).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks nothing for an item this browser keeps only here: the index has never heard of it', () => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.setItem(
      thisBrowserKey('livedocuments'),
      JSON.stringify({ v: 1, items: [{ id: 'local1' }] }),
    );
    try {
      expect(run('/document/local1?s=CODE2345')).toBeUndefined();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      localStorage.clear();
    }
  });
});
