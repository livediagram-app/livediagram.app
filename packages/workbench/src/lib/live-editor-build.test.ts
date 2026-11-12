// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LIVE_BUILD_READ_LIMIT,
  LIVE_BUILD_TIMEOUT_MS,
  checkLiveEditor,
  readBuildMeta,
} from './live-editor-build';

// docs/specs/016-platform/new-version-prompt.md "When the prompt shows", in each product.
const META = 'liveplanner-build';
const head = (build: string) =>
  `<!DOCTYPE html><html><head><meta charSet="utf-8"/><script>var m=document.querySelector('meta[name="${META}"]');</script><meta name="${META}" content="${build}"/></head><body>${'x'.repeat(5000)}</body></html>`;

// A response whose body arrives in the given pieces, recording how many were read.
function streamed(chunks: string[]) {
  const encoder = new TextEncoder();
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled === chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[pulled++]));
    },
  });
  return { response: new Response(body, { status: 200 }), pulled: () => pulled };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('readBuildMeta', () => {
  it('reads the named meta, past other metas and a script naming it', () => {
    expect(readBuildMeta(head('abc123'), META)).toBe('abc123');
  });

  it('is null without the meta, without its content, or with an unfinished tag', () => {
    expect(readBuildMeta('<head><meta charSet="utf-8"/></head>', META)).toBeNull();
    expect(readBuildMeta(`<meta name="${META}"/>`, META)).toBeNull();
    expect(readBuildMeta(`<meta name="${META}" content=""/>`, META)).toBeNull();
    expect(readBuildMeta(`<meta name="${META}" content="abc`, META)).toBeNull();
    expect(readBuildMeta(`<meta name="${META}" content="abc/>`, META)).toBeNull();
    expect(readBuildMeta('', META)).toBeNull();
  });

  it('reads the content either side of the name', () => {
    expect(readBuildMeta(`<meta content="b2" name="${META}">`, META)).toBe('b2');
  });
});

describe('checkLiveEditor', () => {
  it('answers unknown without a request when this editor has no build id', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await checkLiveEditor({ metaName: META, ownBuild: null, fetchImpl })).toBe('unknown');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('asks the current page, uncached, and compares its build', async () => {
    window.history.replaceState(null, '', '/project/p1?view=board#tab');
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(head('own'), { status: 200 }));
    expect(await checkLiveEditor({ metaName: META, ownBuild: 'own', fetchImpl })).toBe('same');
    expect(fetchImpl).toHaveBeenCalledWith(
      '/project/p1?view=board',
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }),
    );
    fetchImpl.mockImplementation(async () => new Response(head('next'), { status: 200 }));
    expect(await checkLiveEditor({ metaName: META, ownBuild: 'own', fetchImpl })).toBe('newer');
  });

  it('answers unknown on an error status, a failed request or a page without the meta', async () => {
    const opts = { metaName: META, ownBuild: 'own', url: '/p' };
    expect(
      await checkLiveEditor({ ...opts, fetchImpl: async () => new Response('', { status: 503 }) }),
    ).toBe('unknown');
    expect(
      await checkLiveEditor({
        ...opts,
        fetchImpl: () => Promise.reject(new TypeError('offline')),
      }),
    ).toBe('unknown');
    expect(
      await checkLiveEditor({
        ...opts,
        fetchImpl: async () => new Response('<head></head><body></body>', { status: 200 }),
      }),
    ).toBe('unknown');
  });

  it('reads a body without a stream as text', async () => {
    const response = {
      ok: true,
      body: null,
      text: async () => head('next'),
    } as unknown as Response;
    expect(
      await checkLiveEditor({
        metaName: META,
        ownBuild: 'own',
        url: '/p',
        fetchImpl: async () => response,
      }),
    ).toBe('newer');
  });

  it('stops reading at the meta, across a split chunk, and leaves the rest of the page', async () => {
    const page = head('next');
    const cut = page.indexOf('content=') + 4;
    const rest = Array.from({ length: 20 }, () => 'y'.repeat(1000));
    const { response, pulled } = streamed([page.slice(0, cut), page.slice(cut), ...rest]);
    expect(
      await checkLiveEditor({
        metaName: META,
        ownBuild: 'own',
        url: '/p',
        fetchImpl: async () => response,
      }),
    ).toBe('newer');
    expect(pulled()).toBeLessThanOrEqual(3);
  });

  it('stops at the end of the head when the page has no meta', async () => {
    const { response, pulled } = streamed([
      '<head><title>x</title></head>',
      ...Array.from({ length: 20 }, () => 'y'.repeat(1000)),
    ]);
    expect(
      await checkLiveEditor({
        metaName: META,
        ownBuild: 'own',
        url: '/p',
        fetchImpl: async () => response,
      }),
    ).toBe('unknown');
    expect(pulled()).toBeLessThanOrEqual(2);
  });

  it('stops at the end of the stream, or past the read limit', async () => {
    const short = streamed(['<html>', '<body>']);
    expect(
      await checkLiveEditor({
        metaName: META,
        ownBuild: 'own',
        url: '/p',
        fetchImpl: async () => short.response,
      }),
    ).toBe('unknown');
    const huge = streamed([
      'z'.repeat(LIVE_BUILD_READ_LIMIT + 1),
      ...Array.from({ length: 5 }, () => 'z'.repeat(1000)),
    ]);
    expect(
      await checkLiveEditor({
        metaName: META,
        ownBuild: 'own',
        url: '/p',
        fetchImpl: async () => huge.response,
      }),
    ).toBe('unknown');
    expect(huge.pulled()).toBeLessThanOrEqual(2);
  });

  it('gives up as unknown when the page does not answer in time', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const answer = checkLiveEditor({ metaName: META, ownBuild: 'own', url: '/p', fetchImpl });
    await vi.advanceTimersByTimeAsync(LIVE_BUILD_TIMEOUT_MS);
    expect(await answer).toBe('unknown');
  });
});
