import { describe, expect, it } from 'vitest';
import { classOf, sampleMembers, sweepPaths, tracePathReads } from './route-sweep.js';

const PATH = 'api/documents/d1/pages/p1/comments';
const segmentsOf = (/** @type {string} */ pathname) => pathname.replace(/^\//, '').split('/');

describe('tracePathReads', () => {
  it('records the segments read by index, through either split of the path', async () => {
    const bare = await tracePathReads(PATH, async () => {
      const segments = segmentsOf(`/${PATH}`);
      return segments.length === 6 && segments[1] === 'documents' && segments[3] === 'pages';
    });
    expect(bare).toEqual({ value: true, reads: new Set([1, 3]), whole: false });
    // With the leading slash kept, the empty first part is no segment.
    const slashed = await tracePathReads(PATH, async () => `/${PATH}`.split('/')[4]);
    expect(slashed).toEqual({ value: 'pages', reads: new Set([3]), whole: false });
  });

  it('stops at the first condition that fails, as the dispatch does', async () => {
    const { reads } = await tracePathReads(PATH, async () => {
      const segments = segmentsOf(`/${PATH}`);
      return segments[3] === 'tabs' && segments[5] === 'comments';
    });
    expect([...reads]).toEqual([3]);
  });

  it('records the rest of the path as it is read, not when it is sliced off', async () => {
    const { reads, whole } = await tracePathReads(PATH, async () => {
      const rest = segmentsOf(`/${PATH}`).slice(3);
      return rest.length === 3 && rest[0] === 'pages';
    });
    expect([...reads]).toEqual([3]);
    expect(whole).toBe(false);
    // Any other slice, a rest pattern or a join reads every segment it copies.
    const copied = await tracePathReads(PATH, async () => {
      const [, , , ...rest] = segmentsOf(`/${PATH}`);
      return rest;
    });
    expect(copied.value).toEqual(['pages', 'p1', 'comments']);
    expect([...copied.reads].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    const cut = await tracePathReads(PATH, async () => segmentsOf(`/${PATH}`).slice(1, 3));
    expect(cut.value).toEqual(['documents', 'd1']);
    expect([...cut.reads].sort()).toEqual([1, 2]);
  });

  it('follows endsWith to the last segment and startsWith to the leading ones', async () => {
    const ends = await tracePathReads(PATH, async () => `/${PATH}`.endsWith('/comments'));
    expect(ends).toEqual({ value: true, reads: new Set([5]), whole: false });
    const starts = await tracePathReads(PATH, async () => `/${PATH}`.startsWith('/api/documents'));
    expect(starts).toEqual({ value: true, reads: new Set([0, 1]), whole: false });
    const bare = await tracePathReads(PATH, async () => PATH.startsWith('api/'));
    expect([...bare.reads]).toEqual([0, 1]);
    // Across a segment's edge, or from a position, it is not one segment's read.
    for (const read of [
      () => `/${PATH}`.endsWith('p1/comments'),
      () => `/${PATH}`.endsWith('/comments', 40),
      () => `/${PATH}`.startsWith('/api', 0),
    ])
      expect((await tracePathReads(PATH, async () => read())).whole).toBe(true);
  });

  it('counts the whole path as read by anything it cannot follow', async () => {
    const opaque = [
      () => /pages\/([^/]+)/.exec(`/${PATH}`),
      () => /comments$/.test(PATH),
      () => `/${PATH}`.match(/pages/),
      () => `/${PATH}`.slice(5),
      () => `/${PATH}`.includes('pages'),
      () => `/${PATH}`.indexOf('pages'),
      () => `/${PATH}`.replace('pages', 'tabs'),
      () => 2 in segmentsOf(`/${PATH}`),
      () => Object.keys(segmentsOf(`/${PATH}`)),
    ];
    for (const read of opaque)
      expect((await tracePathReads(PATH, async () => read())).whole, String(read)).toBe(true);
    // The same reads of another string, and a comparison of the whole path, read nothing.
    const quiet = await tracePathReads(PATH, async () => {
      const other = `/${PATH}/more`;
      return [
        other.slice(5),
        other.split('/')[3],
        /pages/.test(other),
        `/${PATH}` === '/api/events',
      ];
    });
    expect(quiet).toEqual({
      value: ['documents/d1/pages/p1/comments/more', 'd1', true, false],
      reads: new Set(),
      whole: false,
    });
  });

  it('records nothing once the run says its outcome is settled', async () => {
    const { reads, whole } = await tracePathReads(PATH, async (stop) => {
      const segments = segmentsOf(`/${PATH}`);
      if (segments[1] === 'documents') stop();
      return [segments[4], segments.join('/'), `/${PATH}`.slice(2)];
    });
    expect([...reads]).toEqual([1]);
    expect(whole).toBe(false);
  });

  it('puts every method back, also when the run throws', async () => {
    const before = [
      String.prototype.split,
      String.prototype.endsWith,
      String.prototype.startsWith,
      String.prototype.replace,
      String.prototype.slice,
      String.prototype.matchAll,
      RegExp.prototype.exec,
    ];
    await expect(
      tracePathReads(PATH, async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');
    expect([
      String.prototype.split,
      String.prototype.endsWith,
      String.prototype.startsWith,
      String.prototype.replace,
      String.prototype.slice,
      String.prototype.matchAll,
      RegExp.prototype.exec,
    ]).toEqual(before);
    expect(Object.keys(String.prototype)).toEqual([]);
  });
});

// A dispatch as the Workers write theirs: a flat list of conditions on the length and on literal positions.
const PARAM = 'probe-param';
/** @param {string} method @param {string[]} segments */
function answer(method, segments) {
  if (segments[1] !== 'documents') return 404;
  if (segments.length === 2) return method === 'GET' || method === 'POST' ? 200 : 405;
  if (segments.length === 3) return method === 'GET' ? 200 : 405;
  if (segments.length === 4 && segments[3] === 'copy') return method === 'POST' ? 201 : 405;
  if (segments[3] === 'pages') {
    if (segments.length === 4) return 200;
    if (segments.length === 5) return method === 'DELETE' ? 204 : 200;
    if (segments.length === 6 && segments[5] === 'comments') return 200;
    return 404;
  }
  // A handler that forgot the length: it serves every extension of its path.
  if (segments[3] === 'export' && segments[4] === 'pdf') return 200;
  return 404;
}
const VOCABULARY = new Map([
  [2, ['copy', 'pages', 'export']],
  [3, ['pdf']],
  [4, ['comments', 'votes', 'runs', 'rules']],
]);
const METHODS = ['GET', 'POST', 'DELETE'];
let sent = 0;
/** @param {string} method @param {string[]} path */
const send = async (method, path) => {
  sent += 1;
  const traced = await tracePathReads(`api/${path.join('/')}`, async () =>
    answer(method, segmentsOf(`/api/${path.join('/')}`)),
  );
  return {
    result: traced.value,
    reads: new Set([...traced.reads].map((index) => index - 1)),
    whole: traced.whole,
  };
};
/** Every path of the full product, up to `maxLength`. @param {number} maxLength */
function product(maxLength) {
  let frontier = [['documents']];
  const out = [...frontier];
  for (let index = 1; index < maxLength; index++) {
    const options = [PARAM, ...(VOCABULARY.get(index) ?? [])];
    frontier = frontier.flatMap((prefix) => options.map((option) => [...prefix, option]));
    out.push(...frontier);
  }
  return out;
}

describe('sweepPaths', () => {
  it('sends one path of each class, and every path of the product falls in a class that answers as it does', async () => {
    sent = 0;
    const options = { root: 'documents', vocabulary: VOCABULARY, maxLength: 6, param: PARAM };
    const swept = await sweepPaths({ ...options, methods: METHODS, send });
    const all = product(6);
    expect(all).toHaveLength(1 + 1 + 4 + 8 + 40 + 40);
    expect(swept.sent).toBe(sent);
    expect(swept.classes).toHaveLength(swept.sent);
    // Far fewer requests than the product's, in every method.
    expect(swept.sent).toBeLessThan((all.length * METHODS.length) / 3);
    for (const method of METHODS)
      for (const path of all)
        expect(
          classOf(swept.trees, method, path, PARAM)?.result,
          `${method} ${path.join('/')}`,
        ).toBe(answer(method, ['api', ...path]));
    // The handler without a length check is found one level deeper than its path, as the product finds it.
    expect(
      swept.classes
        .filter((c) => c.result === 200 && c.path.length === 5)
        .map((c) => `${c.method} ${c.path.join('/')}`),
    ).toContain(`GET documents/${PARAM}/export/pdf/${PARAM}`);
  });

  it('falls back to the whole product where a request read the path some other way', async () => {
    const options = {
      root: 'documents',
      vocabulary: VOCABULARY,
      maxLength: 5,
      methods: ['GET'],
      param: PARAM,
    };
    const swept = await sweepPaths({
      ...options,
      send: async (method, path) => ({
        result: answer(method, ['api', ...path]),
        reads: new Set(),
        whole: true,
      }),
    });
    expect(swept.classes.map((c) => c.path.join('/')).sort()).toEqual(
      product(5)
        .map((path) => path.join('/'))
        .sort(),
    );
  });

  it('knows no class for a path it did not reach', async () => {
    const swept = await sweepPaths({
      root: 'documents',
      vocabulary: VOCABULARY,
      maxLength: 3,
      methods: ['GET'],
      param: PARAM,
      send,
    });
    expect(classOf(swept.trees, 'GET', ['documents', 'a', 'b', 'c'], PARAM)).toBeUndefined();
    expect(classOf(swept.trees, 'PUT', ['documents'], PARAM)).toBeUndefined();
    // A segment no literal names falls with the parameter.
    expect(classOf(swept.trees, 'GET', ['documents', 'x', 'elsewhere'], PARAM)?.result).toBe(404);
  });
});

describe('sampleMembers', () => {
  const options = { root: 'documents', vocabulary: VOCABULARY, maxLength: 6, param: PARAM };

  it('draws the same members of the product on every run', () => {
    const drawn = sampleMembers({ ...options, count: 300 });
    expect(drawn).toHaveLength(300);
    expect(sampleMembers({ ...options, count: 300 })).toEqual(drawn);
    expect(sampleMembers({ ...options, count: 300, seed: 2 })).not.toEqual(drawn);
    const all = new Set(product(6).map((path) => path.join('/')));
    for (const path of drawn) expect(all.has(path.join('/'))).toBe(true);
    // Every length, and the literals as well as the parameter.
    expect(new Set(drawn.map((path) => path.length))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(new Set(drawn.flatMap((path) => path.slice(1)))).toEqual(
      new Set([PARAM, 'copy', 'pages', 'export', 'pdf', 'comments', 'votes', 'runs', 'rules']),
    );
  });
});
