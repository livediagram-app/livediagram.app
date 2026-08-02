import { beforeEach, describe, expect, it } from 'vitest';
import {
  announce,
  getAnnouncementSnapshot,
  getServerAnnouncementSnapshot,
  subscribeAnnouncements,
} from './announcer';

// The screen-reader announcement store (spec/71). Small, pure, and untested —
// and it carries one property that is easy to break and impossible to notice
// without assistive tech: the nonce.
//
// A live region only re-announces when its DOM content CHANGES. Deleting two
// squares in a row produces the same string twice, so CanvasLiveRegion appends
// a no-break space on odd nonces to force a change. That means the nonce must
// increment on every announce — including a repeat — and must alternate parity
// each time. An "optimisation" that skipped the update when the message
// matched would silence the second announcement entirely, and everything would
// still look correct on screen.

/** Drain any listeners a previous test left attached. */
const unsubs: (() => void)[] = [];
beforeEach(() => {
  while (unsubs.length) unsubs.pop()!();
});
function listen(fn: () => void) {
  const off = subscribeAnnouncements(fn);
  unsubs.push(off);
  return off;
}

describe('announce', () => {
  it('makes the message the current snapshot', () => {
    announce('Deleted a Square');
    expect(getAnnouncementSnapshot().message).toBe('Deleted a Square');
  });

  it('bumps the nonce on every announce, repeats included', () => {
    const before = getAnnouncementSnapshot().nonce;
    announce('Deleted a Square');
    announce('Deleted a Square');
    announce('Deleted a Square');
    expect(getAnnouncementSnapshot().nonce).toBe(before + 3);
  });

  it('alternates nonce parity, which is what forces re-announcement', () => {
    // CanvasLiveRegion renders a trailing space on odd nonces only, so two
    // consecutive announcements must land on different parities or the DOM
    // never changes and the screen reader stays silent.
    announce('Undid Move');
    const first = getAnnouncementSnapshot().nonce % 2;
    announce('Undid Move');
    expect(getAnnouncementSnapshot().nonce % 2).not.toBe(first);
  });

  it('returns a fresh snapshot object each time, never a mutated one', () => {
    // useSyncExternalStore compares snapshots by identity. Mutating in place
    // would make React skip the re-render and nothing would be spoken.
    announce('One');
    const a = getAnnouncementSnapshot();
    announce('Two');
    const b = getAnnouncementSnapshot();
    expect(a).not.toBe(b);
    expect(a.message).toBe('One');
  });

  it('notifies every subscriber', () => {
    const seen: string[] = [];
    listen(() => seen.push('a'));
    listen(() => seen.push('b'));
    announce('Grouped 3 elements');
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('notifies on a repeated message too', () => {
    let calls = 0;
    listen(() => calls++);
    announce('Locked');
    announce('Locked');
    expect(calls).toBe(2);
  });

  it('stops notifying after unsubscribe', () => {
    let calls = 0;
    const off = listen(() => calls++);
    announce('First');
    off();
    announce('Second');
    expect(calls).toBe(1);
  });

  it('announces the empty string rather than ignoring it', () => {
    // Clearing the region is a legitimate announcement; dropping it would
    // leave the last message readable to a screen reader indefinitely.
    announce('Something');
    const before = getAnnouncementSnapshot().nonce;
    announce('');
    expect(getAnnouncementSnapshot().message).toBe('');
    expect(getAnnouncementSnapshot().nonce).toBe(before + 1);
  });
});

describe('the server snapshot', () => {
  it('is empty and stable, whatever the client store holds', () => {
    announce('Client-only message');
    expect(getServerAnnouncementSnapshot().message).toBe('');
    // Stable identity: a server snapshot that differed between calls makes
    // useSyncExternalStore throw during static export.
    expect(getServerAnnouncementSnapshot()).toBe(getServerAnnouncementSnapshot());
  });
});
