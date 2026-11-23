// @vitest-environment jsdom
// docs/specs/021-event-storming/note-reader.md "AI credits (Pro)": with Pro on a read names its diagram and itself,
// its first batch goes alone and the rest ride its pass, and a refusal for credits hands the photo to this device.
// With Pro off the requests are the crops alone, two at a time, exactly as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { apiAiReadNotes } from '@/lib/api/ai';
import {
  knownReadCount,
  noteReadCredits,
  noteReadCreditsUsed,
  readCredits,
  readOnDevice,
  readOwner,
  readPassLive,
  readRun,
  rereadOnDevice,
  resetReadCreditsForTests,
  setReadOwner,
  setReadTarget,
  startReadRun,
} from './read-credits';
import { readCharged } from './read-charged';
import {
  CREDITS_USED_PLAIN,
  creditsLeftWords,
  creditsShortWords,
  READ_ON_DEVICE_LABEL,
  readWithAiLabel,
  creditsOffer,
  creditsResetDay,
  creditsUsedTitle,
  creditsUsedWords,
  readCreditLine,
} from './read-credits-words';
import { selectReader } from './select';

const browser = vi.hoisted(() => ({ readCropsInBrowser: vi.fn() }));
vi.mock('./browser-reader', () => browser);

const crops = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i, image: 'data:image/jpeg;base64,AAA' }));
type Sent = { body: Record<string, unknown>; share: string | null; inFlight: number };

/** The api: answers every batch, with `credits` on each when the read is counted. */
function api(answer: (sent: Sent, call: number) => Response | null = () => null) {
  const sent: Sent[] = [];
  let inFlight = 0;
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    inFlight++;
    const body = JSON.parse(init!.body as string) as Record<string, unknown>;
    const entry = { body, share: new Headers(init!.headers).get('X-Share-Code'), inFlight };
    sent.push(entry);
    await new Promise((resolve) => setTimeout(resolve, 1));
    inFlight--;
    const given = answer(entry, sent.length);
    if (given) return given;
    const texts = (body.crops as { id: number }[]).map((c) => ({
      id: c.id,
      text: `note ${c.id}`,
      legible: true,
    }));
    return Response.json({ texts });
  }) as unknown as typeof fetch;
  return sent;
}
const counted = (sent: Sent, over: Record<string, unknown> = {}) =>
  Response.json({
    texts: (sent.body.crops as { id: number }[]).map((c) => ({
      id: c.id,
      text: 'x',
      legible: true,
    })),
    credits: { owner: 'p:user_owner', pass: 'pass-1', ...over },
  });

const originalFetch = globalThis.fetch;
beforeEach(() => {
  resetReadCreditsForTests();
  browser.readCropsInBrowser.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  setProForTests(null);
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('with Pro off', () => {
  it('sends the crops alone, two batches at a time, and keeps nothing', async () => {
    setReadTarget({ documentId: 'doc1', shareCode: 'LINK' });
    const sent = api();
    await apiAiReadNotes('owner-1', crops(20));
    expect(sent.map((s) => Object.keys(s.body))).toEqual([
      ['crops'],
      ['crops'],
      ['crops'],
      ['crops'],
    ]);
    expect(sent.map((s) => s.inFlight)).toEqual([1, 2, 1, 2]);
    expect(sent.every((s) => s.share === null)).toBe(true);
    expect(readCredits()).toEqual({ owner: null, cost: null, count: null, spent: null });
    // Nothing new is sent with Pro off, a note count included.
    expect(sent.every((s) => !('notes' in s.body))).toBe(true);
  });
});

describe('with Pro on', () => {
  beforeEach(() => setProForTests(true));

  it('names the diagram and the read, sends the first batch alone and the rest on its pass', async () => {
    setReadTarget({ documentId: 'doc1', shareCode: 'LINK' });
    startReadRun(20, true);
    const run = readRun().id;
    expect(run).toMatch(/^[A-Za-z0-9_-]{16}$/);
    const sent = api((s, call) => counted(s, call === 1 ? { used: 12, max: 50, cost: 1 } : {}));
    const out = await apiAiReadNotes('owner-1', crops(20));
    expect(out.texts).toHaveLength(20);
    expect(sent[0]).toMatchObject({
      body: { documentId: 'doc1', read: run, notes: 20 },
      share: 'LINK',
      inFlight: 1,
    });
    expect(sent[0]!.body).not.toHaveProperty('pass');
    // The first went alone; the others two at a time, each carrying the pass.
    expect(sent.slice(1).map((s) => s.inFlight)).toEqual([1, 2, 1]);
    expect(
      sent.slice(1).every((s) => s.body.pass === 'pass-1' && s.body.read === run && s.body.notes),
    ).toBe(true);
    expect(readCredits()).toEqual({
      owner: 'p:user_owner',
      cost: 1,
      count: { used: 12, max: 50 },
      spent: null,
    });
    // Kept for the next photo of this diagram's choice, and for no other diagram.
    startReadRun(3, true);
    expect(knownReadCount()).toEqual({ used: 12, max: 50 });
    setReadTarget({ documentId: 'doc2', shareCode: null });
    expect(knownReadCount()).toBeNull();
  });

  it('goes one batch at a time until it holds a pass, and takes the pass a failed request hands back', async () => {
    startReadRun(30, true);
    const sent = api((s, call) =>
      call === 1
        ? Response.json(
            { error: 'ai_error', credits: { owner: 'p:user_owner', pass: 'pass-9', cost: 2 } },
            { status: 502 },
          )
        : counted(s, { pass: 'pass-9' }),
    );
    const out = await apiAiReadNotes('owner-1', crops(30));
    expect(out).toMatchObject({ unread: 6, failure: 'ai_error' });
    expect(sent.map((s) => s.inFlight)).toEqual([1, 1, 2, 1, 2]);
    expect(sent.slice(1).every((s) => s.body.pass === 'pass-9')).toBe(true);
    expect(readCredits().cost).toBe(2);
    // With no pass in a failure, the next still goes alone: never two spends at once.
    startReadRun(12, true);
    const again = api((s, call) =>
      call === 1 ? Response.json({ error: 'ai_error' }, { status: 502 }) : counted(s),
    );
    await apiAiReadNotes('owner-1', crops(12));
    expect(again.map((s) => s.inFlight)).toEqual([1, 1]);
  });

  it('reads a note again on the same pass, and starts afresh for a new photo', async () => {
    startReadRun(2, true);
    const sent = api((s) => counted(s));
    await apiAiReadNotes('owner-1', crops(2));
    await apiAiReadNotes('owner-1', crops(1));
    expect(sent[1]!.body).toMatchObject({ pass: 'pass-1', read: sent[0]!.body.read });
    startReadRun();
    await apiAiReadNotes('owner-1', crops(1));
    expect(sent[2]!.body).not.toHaveProperty('pass');
    expect(sent[2]!.body.read).not.toBe(sent[0]!.body.read);
    // No diagram open, no link: neither is sent.
    expect(sent[2]!.body).not.toHaveProperty('documentId');
    expect(sent[2]!.share).toBeNull();
  });

  it('against an api with Pro off, carries on two at a time after the first', async () => {
    const sent = api();
    await apiAiReadNotes('owner-1', crops(20));
    expect(sent.map((s) => s.inFlight)).toEqual([1, 1, 2, 1]);
    expect(readCredits().owner).toBeNull();
  });

  it('hands the photo to this device when the credits are used, with no "AI is resting"', async () => {
    startReadRun();
    api(() =>
      Response.json(
        {
          error: 'ai_credits_used',
          limit: 'aiCreditsPerMonth',
          used: 50,
          max: 50,
          owner: 'p:user_owner',
        },
        { status: 429 },
      ),
    );
    browser.readCropsInBrowser.mockResolvedValue({
      textById: new Map([[0, { text: 'here', legible: true }]]),
    });
    const onFallback = vi.fn();
    const result = await selectReader({ aiEnabled: true, ownerId: 'owner-1' }).read(crops(8), {
      onFallback,
    });
    // One request, refused: the rest of the photo never asks the server.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(browser.readCropsInBrowser).toHaveBeenCalledOnce();
    expect(result).toEqual({ textById: new Map([[0, { text: 'here', legible: true }]]) });
    expect(onFallback).not.toHaveBeenCalled();
    expect(readCredits()).toEqual({
      owner: 'p:user_owner',
      cost: null,
      count: null,
      spent: { used: 50, max: 50 },
    });
    // The device reader failing is said as its own failure.
    browser.readCropsInBrowser.mockResolvedValue({
      textById: new Map(),
      failure: 'reader_unavailable',
      detail: 'no model',
    });
    startReadRun();
    expect(await selectReader({ aiEnabled: true, ownerId: 'o' }).read(crops(1), {})).toEqual({
      textById: new Map(),
      failure: 'reader_unavailable',
      detail: 'no model',
    });
  });

  it('still says "AI is resting" for the deployment’s own budget', async () => {
    api(() => Response.json({ error: 'ai_quota' }, { status: 429 }));
    browser.readCropsInBrowser.mockResolvedValue({ textById: new Map() });
    const onFallback = vi.fn();
    const result = await selectReader({ aiEnabled: true, ownerId: 'o' }).read(crops(1), {
      onFallback,
    });
    expect(onFallback).toHaveBeenCalledWith('budget');
    expect(result.fallback).toBe('budget');
    expect(readCredits().spent).toBeNull();
  });

  it('keeps a count it was told when a later answer names none, and ignores an answer with no credits', () => {
    noteReadCredits(undefined);
    expect(readCredits().owner).toBeNull();
    noteReadCredits({ owner: 'p:user_owner', used: 3, max: 50 });
    noteReadCredits({ owner: 'p:user_owner', pass: 'pass-2' });
    expect(readCredits().count).toEqual({ used: 3, max: 50 });
    expect(readRun().pass).toBe('pass-2');
    // A used month the api numbered is remembered; one it did not number is not.
    noteReadCreditsUsed({ owner: 'p:user_owner', used: 50, max: 50 });
    expect(knownReadCount()).toEqual({ used: 50, max: 50 });
    resetReadCreditsForTests();
    noteReadCreditsUsed({ owner: 'p:user_owner', used: 0, max: 0 });
    expect(knownReadCount()).toBeNull();
  });
});

describe('whether a read is charged, and where its re-reads go', () => {
  afterEach(() => setProForTests(null));

  it('asks first only with Pro on, signed in, a server reader, and a diagram that is not a guest’s', () => {
    setProForTests(false);
    expect(readCharged(true, true)).toBe(false);
    setProForTests(true);
    expect(readCharged(true, true)).toBe(true);
    expect(readCharged(false, true)).toBe(false);
    expect(readCharged(true, false)).toBe(false);
    setReadTarget({ documentId: 'doc1', shareCode: null });
    setReadOwner('doc1', { owner: 'guest_00000000-0000-4000-8000-000000000001', team: null });
    expect(readOwner()).toEqual({
      owner: 'guest_00000000-0000-4000-8000-000000000001',
      team: null,
    });
    expect(readCharged(true, true)).toBe(false);
    // A team's diagram, or an account's, is charged.
    setReadOwner('doc1', { owner: 'guest_00000000-0000-4000-8000-000000000001', team: 'team_a' });
    expect(readCharged(true, true)).toBe(true);
    setReadOwner('doc1', { owner: 'user_owner' });
    expect(readCharged(true, true)).toBe(true);
    // Another diagram's owner is not this one's.
    setReadOwner('doc9', { owner: 'guest_00000000-0000-4000-8000-000000000001' });
    expect(readOwner()).toEqual({});
  });

  it('reads a charged read’s box again on the device unless the AI read holds a live pass', () => {
    const now = Date.UTC(2026, 10, 20, 12);
    startReadRun(4, false);
    expect(rereadOnDevice(now)).toBe(false);
    startReadRun(4, true);
    expect(readPassLive(now)).toBe(false);
    expect(rereadOnDevice(now)).toBe(true);
    noteReadCredits({ owner: 'p:user_owner', pass: `${now + 1000}.sig` });
    expect(readPassLive(now)).toBe(true);
    expect(rereadOnDevice(now)).toBe(false);
    expect(rereadOnDevice(now + 1000)).toBe(true);
    readOnDevice();
    expect(rereadOnDevice(now)).toBe(true);
  });
});

describe('the words', () => {
  const NOVEMBER = Date.UTC(2026, 10, 20, 12);

  it('names the first of next month, in UTC, as the reader’s locale writes it', () => {
    expect(creditsResetDay(NOVEMBER, 'en-GB')).toBe('1 December');
    expect(creditsUsedWords(NOVEMBER, 'en-GB')).toBe(
      'They come back on 1 December. This photo is being read on this device instead.',
    );
  });

  it('says the cost, what is left, and what the tier above has', () => {
    expect([readCreditLine(true, 1), readCreditLine(false, 1), readCreditLine(false, 3)]).toEqual([
      'Uses 1 AI credit',
      'Used 1 AI credit',
      'Used 3 AI credits',
    ]);
    expect([readWithAiLabel(1), readWithAiLabel(30), readWithAiLabel(1200)]).toEqual([
      'Read 1 Note with AI',
      'Read 30 Notes with AI',
      'Read 1,200 Notes with AI',
    ]);
    expect(READ_ON_DEVICE_LABEL).toBe('Read on This Device');
    expect([creditsShortWords(2, 1), creditsShortWords(17, 3)]).toEqual([
      'Uses 2 AI credits, and 1 is left this month.',
      'Uses 17 AI credits, and 3 are left this month.',
    ]);
    expect(creditsLeftWords(12, 50)).toBe('38 of 50 left this month');
    expect(creditsLeftWords(60, 50)).toBe('0 of 50 left this month');
    expect(creditsUsedTitle(50)).toBe('This Month’s 50 AI Credits Are Used');
    expect(creditsOffer('pro')).toBe('Pro has 1,000 a month.');
    expect(creditsOffer('team')).toBe('Pro for Teams has 500 a member a month.');
    expect(CREDITS_USED_PLAIN).not.toMatch(/\d|Pro|Free/);
  });
});

describe('the store stays server-safe', () => {
  // The api client imports this store and the root layout imports the api client: a React hook here made every
  // server page answer 500. The hook lives with its one client caller (ReadCreditsHost).
  it('imports nothing from React', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(__dirname, 'read-credits.ts'), 'utf8');
    expect(source).not.toMatch(/from 'react'/);
  });
});
