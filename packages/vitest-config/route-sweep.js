// A sweep of a Worker's imperative dispatch that asks about every path its route code can tell apart, without
// sending every path (each product's docs/specs/015-api/api-documentation.md "Drift test").
//
// A dispatch that matches `segments[k] === '<literal>'` has no route table, so its drift test builds candidate
// paths from the literals the code compares each position against and sends them all. That is a product over the
// positions: 28 x 6 x 30 x 8 paths under one resource, in five methods, was 450,000 requests and two minutes of
// a CI job. Nearly all of them are answered alike, because a handler that turned a path away at its third segment
// never looked at the fifth.
//
// So this watches what a request READS. The path's segments are handed to the dispatch as a recording array
// (`tracePathReads`), and a request that read positions 1 and 3 answers for every path that agrees with it there:
// one request stands for the whole class. `sweepPaths` then branches only on the positions a request really read,
// one literal at a time, which reaches every class the full product reaches and nothing else. Whatever reads the
// path some way this cannot follow (a pattern, a slice, a search) counts as having read all of it, so the sweep
// falls back to the full product there rather than guess. `sampleMembers` picks members of the classes for a
// test to send for real, so a read this file does not see shows as a member that answers unlike its class.

/** @typedef {{ reads: Set<number>, whole: boolean }} PathReads */

const SLASH_ONLY = /^\/?[^/]*$/;

/**
 * Runs `run` while every read of `path` (the request path without its leading slash, `api/documents/x`) is
 * recorded, and returns what `run` gave with the segment indexes it read (`api` is 0). `whole` is true when
 * something read the path in a way that is not followed segment by segment: every position then counts as read.
 *
 * `run` is handed `stop`, which ends the recording early: a probe calls it once the request's outcome is settled
 * (it reached storage), so what the Worker reads afterwards to word its failure counts for nothing.
 *
 * Followed: `pathname.split('/')` (with or without the leading slash) and everything read from that array, by
 * index or through an array method; `endsWith` of one segment; `startsWith` of leading segments; the
 * `replace(/^\//, '')` in front of the split. A comparison of the whole path against one string reads nothing: it
 * tells one path from the rest, and that path is a candidate of its own or not one at all.
 *
 * @template T
 * @param {string} path
 * @param {(stop: () => void) => Promise<T>} run
 * @returns {Promise<{ value: T } & PathReads>}
 */
export async function tracePathReads(path, run) {
  const slashed = `/${path}`;
  const count = path.split('/').length;
  /** @type {Set<number>} */
  const reads = new Set();
  let whole = false;
  let recordingOn = true;
  /** @param {number} index */
  const read = (index) => void (recordingOn && reads.add(index));
  const readWhole = () => {
    if (recordingOn) whole = true;
  };
  /** @param {unknown} value @returns {0 | 1 | -1} the split's offset for the path, or -1 for another string */
  const offsetOf = (value) => (value === path ? 0 : value === slashed ? 1 : -1);

  /** @param {string[]} parts @param {number} offset */
  const recording = (parts, offset) =>
    new Proxy(parts, {
      get(target, key, receiver) {
        if (typeof key === 'string') {
          const code = key.charCodeAt(0);
          if (code >= 48 && code <= 57) read(Number(key) - offset);
          // The segments after a prefix (`segments.slice(3)`) are recorded as they are read, not all at once.
          if (key === 'slice')
            return (/** @type {unknown} */ start, /** @type {unknown} */ end) =>
              Number.isInteger(start) && /** @type {number} */ (start) >= 0 && end === undefined
                ? recording(
                    target.slice(/** @type {number} */ (start)),
                    offset - /** @type {number} */ (start),
                  )
                : Array.prototype.slice.call(receiver, start, end);
        }
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        readWhole();
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        readWhole();
        return Reflect.ownKeys(target);
      },
    });

  const string = String.prototype;
  const real = {
    split: string.split,
    endsWith: string.endsWith,
    startsWith: string.startsWith,
    replace: string.replace,
    exec: RegExp.prototype.exec,
  };
  /** The string methods that read some of the path this does not follow: the whole path counts as read. */
  const OPAQUE = /** @type {const} */ ([
    'includes',
    'indexOf',
    'lastIndexOf',
    'slice',
    'substring',
    'at',
    'charAt',
    'search',
    'match',
    'matchAll',
  ]);
  /** @type {Record<string, Function>} */
  const opaque = {};

  // Sloppy `this` would box the string: these are strict (a module), so `this` is the string itself.
  string.split = function split(separator, limit) {
    const parts = real.split.call(this, separator, limit);
    const offset = separator === '/' && limit === undefined ? offsetOf(this) : -1;
    return offset < 0 ? parts : recording(parts, offset);
  };
  string.endsWith = function endsWith(search, position) {
    if (offsetOf(this) >= 0) {
      if (position === undefined && typeof search === 'string' && SLASH_ONLY.test(search))
        read(count - 1);
      else readWhole();
    }
    return real.endsWith.call(this, search, position);
  };
  string.startsWith = function startsWith(search, position) {
    const offset = offsetOf(this);
    if (offset >= 0) {
      if (position === undefined && typeof search === 'string') {
        const lead = real.split.call(offset ? search.replace(/^\//, '') : search, '/');
        for (let i = 0; i < lead.length; i++) read(i);
      } else readWhole();
    }
    return real.startsWith.call(this, search, position);
  };
  string.replace = function replace(pattern, replacement) {
    // The one replace in front of the split drops the leading slash and reads no segment.
    if (offsetOf(this) >= 0 && !(pattern instanceof RegExp && pattern.source === '^\\/'))
      readWhole();
    return real.replace.call(this, pattern, replacement);
  };
  for (const name of OPAQUE) {
    const method = /** @type {Function} */ (string[name]);
    opaque[name] = method;
    Object.defineProperty(string, name, {
      configurable: true,
      writable: true,
      value: function opaqueRead(/** @type {unknown[]} */ ...args) {
        if (offsetOf(this) >= 0) readWhole();
        return method.apply(this, args);
      },
    });
  }
  RegExp.prototype.exec = function exec(text) {
    if (offsetOf(text) >= 0 && this.source !== '^\\/') readWhole();
    return real.exec.call(this, text);
  };

  try {
    const value = await run(() => {
      recordingOn = false;
    });
    return { value, reads, whole };
  } finally {
    string.split = real.split;
    string.endsWith = real.endsWith;
    string.startsWith = real.startsWith;
    string.replace = real.replace;
    RegExp.prototype.exec = real.exec;
    for (const name of OPAQUE)
      Object.defineProperty(string, name, {
        configurable: true,
        writable: true,
        value: opaque[name],
      });
  }
}

/**
 * @template R
 * @typedef {{ path: string[], result: R, at?: number, children?: Map<string, SweepNode<R>> }} SweepNode
 * One class of paths of one length in one method: `path` stands for every path that agrees with it at the
 * positions branched on above it. A node with `at` was split there, one child per literal and one for anything
 * else (`param`).
 */

/**
 * Every class of paths the dispatch tells apart, each sent once.
 *
 * `vocabulary` maps a path index (0 is the resource segment) to the literals the route code compares that
 * position against; `param` stands in for any other value. `send` sends one path in one method and says what it
 * read, as path indexes (so `tracePathReads`'s indexes less the segments in front of the path).
 *
 * @template R
 * @param {{
 *   root: string,
 *   vocabulary: Map<number, Iterable<string>>,
 *   maxLength: number,
 *   methods: readonly string[],
 *   param: string,
 *   send: (method: string, path: string[]) => Promise<{ result: R } & PathReads>,
 * }} options
 * @returns {Promise<{ classes: { method: string, path: string[], result: R }[], trees: Map<string, SweepNode<R>>, sent: number }>}
 */
export async function sweepPaths({ root, vocabulary, maxLength, methods, param, send }) {
  /** @type {{ method: string, path: string[], result: R }[]} */
  const classes = [];
  /** @type {Map<string, SweepNode<R>>} */
  const trees = new Map();
  let sent = 0;

  /**
   * @param {string} method
   * @param {string[]} path
   * @param {Set<number>} fixed
   * @param {({ result: R } & PathReads) | undefined} known what sending `path` gave, when it was sent already
   * @returns {Promise<SweepNode<R>>}
   */
  const explore = async (method, path, fixed, known) => {
    const answer = known ?? (sent++, await send(method, path));
    let at = -1;
    for (let i = 1; i < path.length && at < 0; i++)
      if (!fixed.has(i) && (answer.whole || answer.reads.has(i))) at = i;
    if (at < 0) {
      classes.push({ method, path, result: answer.result });
      return { path, result: answer.result };
    }
    /** @type {Map<string, SweepNode<R>>} */
    const children = new Map();
    const below = new Set(fixed).add(at);
    // The path as sent has `param` here: that child is the same request, so its answer carries over.
    children.set(param, await explore(method, path, below, answer));
    for (const literal of vocabulary.get(at) ?? []) {
      const next = [...path];
      next[at] = literal;
      children.set(literal, await explore(method, next, below, undefined));
    }
    return { path, result: answer.result, at, children };
  };

  for (const method of methods) {
    for (let length = 1; length <= maxLength; length++) {
      const path = [root, ...Array.from({ length: length - 1 }, () => param)];
      trees.set(`${method} ${length}`, await explore(method, path, new Set(), undefined));
    }
  }
  return { classes, trees, sent };
}

/**
 * The class a path falls in: the leaf of its method's and length's tree, or undefined for a path the sweep did
 * not reach (another root, or longer than `maxLength`).
 *
 * @template R
 * @param {Map<string, SweepNode<R>>} trees
 * @param {string} method
 * @param {readonly string[]} path
 * @param {string} param
 * @returns {SweepNode<R> | undefined}
 */
export function classOf(trees, method, path, param) {
  let node = trees.get(`${method} ${path.length}`);
  while (node?.children) {
    const segment = path[/** @type {number} */ (node.at)];
    node = node.children.get(segment ?? param) ?? node.children.get(param);
  }
  return node;
}

/**
 * `count` paths of the full product drawn evenly by a fixed seed, for a test to send for real and hold against
 * `classOf`: the same paths on every run, so a miss is a read the trace did not follow, never chance.
 *
 * @param {{ root: string, vocabulary: Map<number, Iterable<string>>, maxLength: number, param: string, count: number, seed?: number }} options
 * @returns {string[][]}
 */
export function sampleMembers({ root, vocabulary, maxLength, param, count, seed = 1 }) {
  // mulberry32: a small seeded generator, the same sequence everywhere.
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** @type {string[][]} */
  const out = [];
  for (let n = 0; n < count; n++) {
    const length = 1 + Math.floor(random() * maxLength);
    const path = [root];
    for (let i = 1; i < length; i++) {
      const options = [param, ...(vocabulary.get(i) ?? [])];
      path.push(/** @type {string} */ (options[Math.floor(random() * options.length)]));
    }
    out.push(path);
  }
  return out;
}
