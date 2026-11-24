import { describe, expect, it, vi } from 'vitest';
import type { PageReadingResponse } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { createReadingStore, withOwnRead } from './reading-store';
import { readAgainOf, registerReadAgainSender, setReadAgain, takeReadAgain } from './read-again';
import {
  audienceText,
  bannerLine,
  lastRemindedText,
  progressText,
  readingFailureText,
  remindText,
} from './reading-words';

// docs/specs/030-knowledgebase/required-reading.md: the store's one read a session, I've Read This shown at once and put
// back on a refusal, a change replaced by the api's answer, Save taking Ask Everyone to Read Again, and the words.

const who = { ownerId: 'user_1', shareCode: null };
const ASKED: PageReadingResponse = {
  required: { audience: 'everyone', askedAt: 1, round: 1 },
  mine: { asked: true },
  progress: { done: 1, total: 3 },
  sees: true,
  manages: true,
  people: [
    { id: 'user_1', name: 'Ada' },
    { id: 'user_2', name: 'Bo', readAt: 5 },
  ],
  email: true,
};

const apiOf = (read: PageReadingResponse = ASKED) => ({
  read: vi.fn(async () => read),
  set: vi.fn(),
  press: vi.fn(),
  remind: vi.fn(),
});

describe('withOwnRead', () => {
  it('counts the caller once, marks them read, and leaves anyone not asked as they were', () => {
    const after = withOwnRead(ASKED, 'user_1', 9);
    expect(after.mine).toEqual({ asked: true, readAt: 9 });
    expect(after.progress).toEqual({ done: 2, total: 3 });
    expect(after.people?.[0]).toEqual({ id: 'user_1', name: 'Ada', readAt: 9 });
    expect(withOwnRead(after, 'user_1', 10)).toBe(after);
    const notAsked = { ...ASKED, mine: { asked: false } };
    expect(withOwnRead(notAsked, 'user_1', 9)).toBe(notAsked);
    const noNames = { ...ASKED, people: undefined, progress: { done: 3, total: 3 } };
    expect(withOwnRead(noNames, null, 9)).toMatchObject({ progress: { done: 3 } });
    expect(withOwnRead(noNames, null, 9).people).toBeUndefined();
    const noProgress = { ...ASKED, progress: null };
    expect(withOwnRead(noProgress, null, 9).progress).toBeNull();
  });
});

describe('createReadingStore', () => {
  it('reads a page once a session, sharing a running read, and again when asked', async () => {
    const api = apiOf();
    const store = createReadingStore(api);
    expect(store.entryOf('kb', 'p').status).toBe('loading');
    await Promise.all([store.load(who, 'kb', 'p'), store.load(who, 'kb', 'p')]);
    await store.load(who, 'kb', 'p');
    expect(api.read).toHaveBeenCalledTimes(1);
    expect(store.entryOf('kb', 'p')).toEqual({ status: 'ready', reading: ASKED });
    await store.load(who, 'kb', 'p', true);
    expect(api.read).toHaveBeenCalledTimes(2);
  });

  it('marks a failed first read, and keeps a good one a later read fails', async () => {
    const api = apiOf();
    api.read.mockRejectedValueOnce(new Error('down'));
    const store = createReadingStore(api);
    await store.load(who, 'kb', 'p');
    expect(store.entryOf('kb', 'p').status).toBe('failed');
    await store.load(who, 'kb', 'p');
    api.read.mockRejectedValueOnce(new Error('down'));
    await store.load(who, 'kb', 'p', true);
    expect(store.entryOf('kb', 'p').status).toBe('ready');
  });

  it('shows I’ve Read This at once, takes the api’s answer, and puts it back on a refusal', async () => {
    const api = apiOf();
    const store = createReadingStore(api);
    const seen: number[] = [];
    const stop = store.subscribe(() => seen.push(store.version()));
    // Not read yet: nothing to change.
    await store.confirm(who, 'kb', 'p', 'user_1', 9);
    expect(api.press).not.toHaveBeenCalled();
    await store.load(who, 'kb', 'p');
    let release!: (r: PageReadingResponse) => void;
    api.press.mockReturnValueOnce(new Promise((r) => (release = r)));
    const pressing = store.confirm(who, 'kb', 'p', 'user_1', 9);
    expect(store.entryOf('kb', 'p').reading.mine.readAt).toBe(9);
    release({ ...ASKED, mine: { asked: true, readAt: 8 } });
    await pressing;
    expect(store.entryOf('kb', 'p').reading.mine.readAt).toBe(8);
    expect(api.press).toHaveBeenCalledWith(who, 'kb', 'p', 'read');
    await store.load(who, 'kb', 'p', true);
    api.press.mockRejectedValueOnce(new ApiError('x', 409, 'not_asked'));
    await expect(store.confirm(who, 'kb', 'p', 'user_1')).rejects.toThrow();
    expect(store.entryOf('kb', 'p').reading).toEqual(ASKED);
    stop();
    expect(seen.length).toBeGreaterThan(3);
  });

  it('replaces the entry with the api’s answer on a change and an ask again', async () => {
    const api = apiOf();
    const store = createReadingStore(api);
    const stopped = { ...ASKED, required: null, progress: null };
    api.set.mockResolvedValueOnce(stopped);
    await store.set(who, 'kb', 'p', { audience: null });
    expect(store.entryOf('kb', 'p').reading).toBe(stopped);
    const again = { ...ASKED, required: { ...ASKED.required!, round: 2 } };
    api.press.mockResolvedValueOnce(again);
    await store.again(who, 'kb', 'p');
    expect(api.press).toHaveBeenLastCalledWith(who, 'kb', 'p', 'read-again');
    expect(store.entryOf('kb', 'p').reading).toBe(again);
  });

  it('reads the page again after a reminder went, and not after one that did not', async () => {
    const api = apiOf();
    const store = createReadingStore(api);
    api.remind.mockResolvedValueOnce({ outcome: 'nobody_pending' });
    expect(await store.remind(who, 'kb', 'p')).toEqual({ outcome: 'nobody_pending' });
    expect(api.read).not.toHaveBeenCalled();
    api.remind.mockResolvedValueOnce({ outcome: 'sent', sent: 2 });
    expect(await store.remind(who, 'kb', 'p')).toEqual({ outcome: 'sent', sent: 2 });
    expect(api.read).toHaveBeenCalledTimes(1);
  });
});

describe('Ask Everyone to Read Again', () => {
  it('is off by default, taken once by Save, and asks through the sender', () => {
    const send = vi.fn();
    expect(takeReadAgain('p')).toBe(false);
    setReadAgain('p', true);
    setReadAgain('p', true);
    expect(readAgainOf('p')).toBe(true);
    // No sender (the toggle went): nothing to ask, though it still turns off.
    expect(takeReadAgain('p')).toBe(false);
    expect(readAgainOf('p')).toBe(false);
    const release = registerReadAgainSender(send);
    setReadAgain('p', true);
    expect(takeReadAgain('p')).toBe(true);
    expect(send).toHaveBeenCalledWith('p');
    expect(takeReadAgain('p')).toBe(false);
    // A newer sender is not let go by an older one's release.
    const newer = vi.fn();
    registerReadAgainSender(newer);
    release();
    setReadAgain('q', true);
    expect(takeReadAgain('q')).toBe(true);
    expect(newer).toHaveBeenCalledWith('q');
    setReadAgain('q', false);
  });
});

describe('reading words', () => {
  it('counts, names the audience and says the banner’s line', () => {
    expect(progressText(7, 12)).toBe('7 of 12 have read it');
    expect(progressText(0, 1)).toBe('0 of 1 has read it');
    expect(audienceText('everyone', 12)).toBe('Everyone');
    expect(audienceText('people', 1)).toBe('1 Person');
    expect(audienceText('people', 4)).toBe('4 People');
    const now = Date.UTC(2026, 10, 22);
    expect(bannerLine(1, now, now)).toBe('Please read this page, then confirm you have.');
    expect(bannerLine(2, Date.UTC(2026, 10, 14), now)).toBe(
      'This page changed on 14 Nov. Please read it again, then confirm.',
    );
    expect(lastRemindedText(now - 2 * 86_400_000, now)).toBe('Last reminded 2 days ago');
  });

  it('says every reminder outcome and every refusal', () => {
    expect(remindText({ outcome: 'sent', sent: 1 })).toBe('Reminded 1 person.');
    expect(remindText({ outcome: 'sent', sent: 5 })).toBe('Reminded 5 people.');
    expect(remindText({ outcome: 'already_sent', nextAt: 1 })).toBe(
      'Everyone not yet read was reminded this week.',
    );
    expect(remindText({ outcome: 'nobody_pending' })).toBe('Nobody is left to remind.');
    expect(remindText({ outcome: 'no_recipients' })).toContain('can get email');
    expect(remindText({ outcome: 'daily_limit' })).toContain('used up');
    expect(remindText({ outcome: 'unavailable' })).toBe('This knowledgebase sends no email.');
    expect(readingFailureText(new ApiError('x', 429, 'reading_too_fast'), 'confirm')).toContain(
      'a lot of changes',
    );
    expect(readingFailureText(new ApiError('x', 500, 'boom'), 'set')).toBe(
      'Required Reading could not be saved. Try again.',
    );
    for (const act of ['confirm', 'stop', 'again', 'remind'] as const)
      expect(readingFailureText(new Error('x'), act)).toMatch(/Try again/);
    // Named, so the toast still reads in the notification list.
    expect(remindText({ outcome: 'sent', sent: 5 }, '“Onboarding”')).toBe(
      'Reminded 5 people to read “Onboarding”.',
    );
    for (const act of ['confirm', 'set', 'stop', 'remind'] as const)
      expect(readingFailureText(new Error('x'), act, '“Onboarding”')).toContain('“Onboarding”');
    expect(readingFailureText(new Error('x'), 'again', '“Onboarding”')).toMatch(/Page Info/);
  });
});
