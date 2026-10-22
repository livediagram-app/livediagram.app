import { beforeAll, describe, expect, it } from 'vitest';
import { createHeldKeyStore } from './held-key-store';

// These tests run in the node environment, where there is no `window`. The
// store attaches its listeners only in a browser, so without a stand-in the
// attach callback never fires and every assertion below tests nothing. The
// stub is empty on purpose: the store never touches window itself, it only
// checks that one exists before handing control to a caller that will.
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as { window?: unknown }).window = {};
  }
});

// The store behind the Shift and Cmd/Ctrl hooks. Neither had a test while each
// carried its own copy of this, and the behaviour is exactly the kind that
// fails quietly: a missed notify is a badge that never appears, a spurious one
// is a re-render on every repeat keydown, and a leaked listener is a banner
// that outlives the component showing it.

/** A store plus the setter its attach callback was handed. */
function makeStore() {
  let set!: (next: boolean) => void;
  let attaches = 0;
  const store = createHeldKeyStore((s) => {
    attaches += 1;
    set = s;
  });
  return { store, press: () => set(true), release: () => set(false), attaches: () => attaches };
}

describe('createHeldKeyStore', () => {
  it('wires nothing until something subscribes', () => {
    // A module-level store is created at import time, so attaching there would
    // add listeners to every page that pulls the module in, used or not.
    const { attaches } = makeStore();
    expect(attaches()).toBe(0);
  });

  it('attaches once however many subscribers arrive', () => {
    const { store, attaches } = makeStore();
    store.subscribe(() => {});
    store.subscribe(() => {});
    store.subscribe(() => {});
    expect(attaches()).toBe(1);
  });

  it('reports not-held until the key goes down', () => {
    const { store, press } = makeStore();
    store.subscribe(() => {});
    expect(store.getSnapshot()).toBe(false);
    press();
    expect(store.getSnapshot()).toBe(true);
  });

  it('notifies only on a real transition', () => {
    // Holding a key fires keydown over and over. Fanning out on each one would
    // re-render every subscriber for the whole time it is held.
    const { store, press, release } = makeStore();
    let calls = 0;
    store.subscribe(() => calls++);
    press();
    expect(calls).toBe(1);
    press();
    press();
    expect(calls).toBe(1);
    release();
    expect(calls).toBe(2);
    release();
    expect(calls).toBe(2);
  });

  it('notifies every subscriber', () => {
    const { store, press } = makeStore();
    const seen: string[] = [];
    store.subscribe(() => seen.push('a'));
    store.subscribe(() => seen.push('b'));
    press();
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('stops notifying after unsubscribe', () => {
    const { store, press, release } = makeStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    press();
    expect(calls).toBe(1);
    off();
    release();
    expect(calls).toBe(1);
  });

  it('keeps the value when the last subscriber leaves', () => {
    // Unsubscribing is a component unmounting, not the key being released.
    const { store, press } = makeStore();
    const off = store.subscribe(() => {});
    press();
    off();
    expect(store.getSnapshot()).toBe(true);
  });

  it('never reports held on the server', () => {
    const { store, press } = makeStore();
    store.subscribe(() => {});
    press();
    expect(store.getServerSnapshot()).toBe(false);
  });

  it('gives each store its own state', () => {
    // Two keys, two stores: pressing Shift must not light up the Cmd badge.
    const a = makeStore();
    const b = makeStore();
    a.store.subscribe(() => {});
    b.store.subscribe(() => {});
    a.press();
    expect(a.store.getSnapshot()).toBe(true);
    expect(b.store.getSnapshot()).toBe(false);
  });
});
