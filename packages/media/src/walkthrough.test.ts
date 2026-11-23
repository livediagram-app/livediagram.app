// The walkthrough contract (liveworkspace/docs/specs/006-media/walkthroughs.md): parsing and sealing the events, a
// start's refusals in order, the media types and their sniffing, and the refusals in words.
import { describe, expect, it } from 'vitest';
import {
  containerOf,
  normaliseWalkthroughAuthor,
  normaliseWalkthroughTitle,
  parseWalkthroughEvents,
  parseWalkthroughStart,
  sealWalkthroughEvents,
  sniffWalkthroughContainer,
  WALKTHROUGH_EVENTS_MAX,
  WALKTHROUGH_HIDDEN_MAX,
  WALKTHROUGH_AUDIO_BPS,
  WALKTHROUGH_MAX_MS,
  WALKTHROUGH_MEDIA_MAX_BYTES,
  walkthroughMediaMaxBytes,
  walkthroughMediaType,
  walkthroughRefusalMessage,
  WALKTHROUGH_VIDEO_BPS,
  walkthroughVideoBps,
  type WalkthroughEvents,
} from './walkthrough';

const base = (over: Record<string, unknown> = {}) => ({
  v: 1,
  durationMs: 5000,
  camera: false,
  corner: 'top-right',
  startTab: 't1',
  hidden: ['h1'],
  fingerprints: { t1: 'f' },
  events: [
    { t: 10, k: 'view', cx: 1, cy: 2, zoom: 1.5, w: 900, h: 700 },
    { t: 20, k: 'cursor', x: 5, y: 6 },
    { t: 30, k: 'cursor-out' },
    { t: 40, k: 'point', id: 'h1' },
    { t: 50, k: 'point', id: 'e2' },
    { t: 60, k: 'tab', tab: 't2' },
    { t: 70, k: 'slide', slide: 's1', label: 'Intro' },
    { t: 80, k: 'slide', slide: null },
  ],
  ...over,
});

describe('the events', () => {
  it('parses every kind and seals the hidden element out', () => {
    const parsed = parseWalkthroughEvents(base());
    expect(parsed?.events.map((e) => e.k)).toEqual([
      'view',
      'cursor',
      'cursor-out',
      'point',
      'tab',
      'slide',
      'slide',
    ]);
    expect(parsed?.events.find((e) => e.k === 'point')).toEqual({ t: 50, k: 'point', id: 'e2' });
    expect(parsed?.events[5]).toEqual({ t: 70, k: 'slide', slide: 's1', label: 'Intro' });
  });

  it('refuses what is not a walkthrough', () => {
    const bad: unknown[] = [
      null,
      'x',
      base({ v: 2 }),
      base({ durationMs: -1 }),
      base({ camera: 'yes' }),
      base({ corner: 'middle' }),
      base({ startTab: '' }),
      base({ hidden: 'h' }),
      base({ hidden: [''] }),
      base({ hidden: Array.from({ length: WALKTHROUGH_HIDDEN_MAX + 1 }, (_, i) => `h${i}`) }),
      base({ fingerprints: null }),
      base({ fingerprints: { t1: 5 } }),
      base({ fingerprints: { t1: 'x'.repeat(129) } }),
      base({
        fingerprints: Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`t${i}`, 'f'])),
      }),
      base({ events: 'no' }),
      base({
        events: Array.from({ length: WALKTHROUGH_EVENTS_MAX + 1 }, () => ({
          t: 0,
          k: 'cursor-out',
        })),
      }),
      base({ events: [null] }),
      base({ events: [{ t: 'a', k: 'cursor-out' }] }),
      base({ events: [{ t: 0, k: 'view', cx: 0, cy: 0, zoom: 0, w: 1, h: 1 }] }),
      base({ events: [{ t: 0, k: 'cursor', x: 'a', y: 0 }] }),
      base({ events: [{ t: 0, k: 'point', id: 5 }] }),
      base({ events: [{ t: 0, k: 'tab', tab: '' }] }),
      base({ events: [{ t: 0, k: 'slide', slide: 5 }] }),
      base({ events: [{ t: 0, k: 'jump' }] }),
      base({ events: [{ t: 6000, k: 'cursor-out' }] }),
      base({ events: [{ t: -1, k: 'cursor-out' }] }),
    ];
    for (const value of bad) expect(parseWalkthroughEvents(value)).toBeNull();
  });

  it('keeps time order, stays inside the recording, and dedupes the hidden list', () => {
    const sealed = sealWalkthroughEvents({
      ...(base() as unknown as WalkthroughEvents),
      durationMs: WALKTHROUGH_MAX_MS + 5000,
      hidden: ['a', 'a', 'b'],
      events: [
        { t: 900_000, k: 'cursor-out' },
        { t: 5.4, k: 'cursor', x: 1, y: 1 },
        { t: 5, k: 'point', id: 'a' },
        { t: -3, k: 'tab', tab: 'x' },
      ],
    });
    expect(sealed.durationMs).toBe(WALKTHROUGH_MAX_MS);
    expect(sealed.hidden).toEqual(['a', 'b']);
    expect(sealed.events).toEqual([
      { t: 0, k: 'tab', tab: 'x' },
      { t: 5, k: 'cursor', x: 1, y: 1 },
      { t: WALKTHROUGH_MAX_MS, k: 'cursor-out' },
    ]);
  });
});

describe('a start', () => {
  const start = (over: Record<string, unknown> = {}) => ({
    item: 'doc',
    title: 'T',
    author: ' Ada  L ',
    mediaType: 'audio/webm;codecs=opus',
    mediaBytes: 1000,
    events: base(),
    ...over,
  });

  it('parses one, with its title and author tidied', () => {
    const parsed = parseWalkthroughStart(start());
    expect(parsed.ok && parsed.start).toMatchObject({
      item: 'doc',
      title: 'T',
      author: 'Ada L',
      mediaType: 'audio/webm',
      mediaBytes: 1000,
    });
  });

  it('refuses cheapest first', () => {
    const refusal = (value: unknown) => {
      const parsed = parseWalkthroughStart(value);
      return parsed.ok ? null : [parsed.refusal.status, parsed.refusal.body.error];
    };
    expect(refusal(null)).toEqual([400, 'invalid_body']);
    expect(refusal([])).toEqual([400, 'invalid_body']);
    expect(refusal(start({ item: '' }))).toEqual([400, 'invalid_item']);
    expect(refusal(start({ mediaType: 'video/ogg' }))).toEqual([415, 'unsupported_type']);
    expect(refusal(start({ mediaBytes: 0 }))).toEqual([400, 'invalid_size']);
    expect(refusal(start({ mediaBytes: 1.5 }))).toEqual([400, 'invalid_size']);
    expect(refusal(start({ mediaBytes: WALKTHROUGH_MEDIA_MAX_BYTES + 1 }))).toEqual([
      413,
      'file_too_large',
    ]);
    expect(refusal(start({ events: base({ durationMs: WALKTHROUGH_MAX_MS + 1 }) }))).toEqual([
      413,
      'too_long',
    ]);
    expect(refusal(start({ events: null }))).toEqual([400, 'invalid_events']);
  });
});

describe('titles, authors and types', () => {
  it('tidies a title and an author', () => {
    expect(normaliseWalkthroughTitle('  a   b ')).toBe('a b');
    expect(normaliseWalkthroughTitle('')).toBe('Walkthrough');
    expect(normaliseWalkthroughTitle(5)).toBe('Walkthrough');
    expect(normaliseWalkthroughTitle('x'.repeat(200))).toHaveLength(120);
    expect(normaliseWalkthroughAuthor(' ')).toBeNull();
    expect(normaliseWalkthroughAuthor(null)).toBeNull();
  });

  it('reads a recorder type and sniffs a container', () => {
    expect(walkthroughMediaType('VIDEO/WEBM; codecs=vp9')).toBe('video/webm');
    expect(walkthroughMediaType('video/ogg')).toBeNull();
    expect(walkthroughMediaType(3)).toBeNull();
    expect(containerOf('audio/webm')).toBe('webm');
    expect(containerOf('video/mp4')).toBe('mp4');
    expect(sniffWalkthroughContainer(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('webm');
    expect(sniffWalkthroughContainer(new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]))).toBe(
      'mp4',
    );
    expect(sniffWalkthroughContainer(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('says every refusal in words', () => {
    const words = (body: Record<string, unknown>) => walkthroughRefusalMessage(body as never);
    expect(words({ error: 'file_too_large' })).toContain('90 MB');
    expect(words({ error: 'too_long' })).toContain('10 minutes');
    expect(words({ error: 'item_full' })).toContain('50');
    expect(words({ error: 'walkthroughs_full', reason: 'bytes' })).toContain('space');
    expect(words({ error: 'walkthroughs_full', reason: 'count', limit: 50 })).toContain('50');
    expect(words({ error: 'unsupported_type' })).toContain('format');
    expect(words({ error: 'forbidden' })).toContain('Editor');
    expect(words({ error: 'walkthroughs_unavailable' })).toContain('right now');
    expect(words({ error: 'other' })).toContain('Try again');
  });
});

describe('the bit rate a longer recording is made at', () => {
  it('is the full rate up to ten minutes', () => {
    expect(walkthroughVideoBps(5 * 60 * 1000)).toBe(WALKTHROUGH_VIDEO_BPS);
    expect(walkthroughVideoBps(WALKTHROUGH_MAX_MS)).toBe(WALKTHROUGH_VIDEO_BPS);
  });

  it('fits thirty minutes into the bytes ten minutes makes, under the one-upload cap', () => {
    const thirty = 30 * 60 * 1000;
    const video = walkthroughVideoBps(thirty);
    expect(video).toBe(301_333);
    const bytes = ((video + WALKTHROUGH_AUDIO_BPS) * (thirty / 1000)) / 8;
    const tenMinutes = ((WALKTHROUGH_VIDEO_BPS + WALKTHROUGH_AUDIO_BPS) * 600) / 8;
    expect(bytes).toBeLessThanOrEqual(tenMinutes);
    // The same fifth to spare ten minutes has, and under the 100 MB a Worker request carries.
    expect(bytes * 1.2).toBeLessThanOrEqual(WALKTHROUGH_MEDIA_MAX_BYTES);
    expect(WALKTHROUGH_MEDIA_MAX_BYTES).toBeLessThan(100_000_000);
  });
});

describe('the length limit, weighed', () => {
  const FIVE = 5 * 60 * 1000;
  const startOf = (mediaBytes: number, durationMs: number) => ({
    item: 'doc-1',
    title: 'Tour',
    author: null,
    mediaType: 'video/webm',
    mediaBytes,
    events: { ...base(), durationMs },
  });

  it('gives a limit under ten minutes its share of the cap, with the same fifth to spare', () => {
    expect(walkthroughMediaMaxBytes(FIVE)).toBe(WALKTHROUGH_MEDIA_MAX_BYTES / 2);
    // Five minutes at the full rates is 39.3 MB: under its share by the fifth an encoder may overshoot.
    const honest = ((WALKTHROUGH_VIDEO_BPS + WALKTHROUGH_AUDIO_BPS) * 300) / 8;
    expect(honest * 1.2).toBeLessThanOrEqual(walkthroughMediaMaxBytes(FIVE));
    expect(walkthroughMediaMaxBytes(60_000)).toBe(Math.ceil(WALKTHROUGH_MEDIA_MAX_BYTES / 10));
    expect(walkthroughMediaMaxBytes(0)).toBe(0);
    expect(walkthroughMediaMaxBytes(-5)).toBe(0);
  });

  it('gives ten minutes or more the whole cap: a longer limit is recorded at a lower rate to the same bytes', () => {
    for (const maxMs of [WALKTHROUGH_MAX_MS, 30 * 60 * 1000, Number.NaN]) {
      expect(walkthroughMediaMaxBytes(maxMs)).toBe(WALKTHROUGH_MEDIA_MAX_BYTES);
    }
  });

  it('refuses a recording that says five minutes and weighs more than five minutes can', () => {
    // Thirty minutes at the lower rate, declared as five: the duration is the browser's word, the bytes are not.
    const half = WALKTHROUGH_MEDIA_MAX_BYTES / 2;
    const lied = parseWalkthroughStart(startOf(half + 1, FIVE), FIVE);
    expect(lied).toEqual({
      ok: false,
      refusal: { status: 413, body: { error: 'file_too_large', limitBytes: half } },
    });
    expect(parseWalkthroughStart(startOf(half, FIVE), FIVE).ok).toBe(true);
    // The same bytes under a limit that allows them, and under the legacy cap with Pro off, are taken.
    expect(parseWalkthroughStart(startOf(half + 1, FIVE), 30 * 60 * 1000).ok).toBe(true);
    expect(parseWalkthroughStart(startOf(WALKTHROUGH_MEDIA_MAX_BYTES, FIVE)).ok).toBe(true);
  });
});

describe('a tier’s length', () => {
  const long = {
    v: 1,
    durationMs: 1_500_000,
    camera: false,
    corner: 'bottom-left',
    startTab: 't',
    hidden: [],
    fingerprints: {},
    events: [],
  };
  const start = { item: 'doc', mediaType: 'video/webm', mediaBytes: 10, events: long };

  it('refuses past ten minutes by default, and words the refusal from its limit', () => {
    const refused = parseWalkthroughStart(start);
    expect(refused).toMatchObject({
      ok: false,
      refusal: { status: 413, body: { error: 'too_long', limitMs: 600_000 } },
    });
    expect(walkthroughRefusalMessage({ error: 'too_long' })).toContain('over 10 minutes');
    expect(walkthroughRefusalMessage({ error: 'too_long', limitMs: 300_000 })).toContain(
      'over 5 minutes',
    );
  });

  it('takes and keeps the whole length when the caller holds a longer limit', () => {
    const taken = parseWalkthroughStart(start, 1_800_000);
    expect(taken.ok && taken.start.events.durationMs).toBe(1_500_000);
    expect(parseWalkthroughStart(start, 1_499_999).ok).toBe(false);
  });
});
