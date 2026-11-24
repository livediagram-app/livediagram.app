// Open in the app from the Inbox's pane when the row's place is on the page already open: a page load, never a
// fragment-only move the editor would not notice (WI-1395).
import { describe, expect, it, vi } from 'vitest';
import { openInPlace, sameDocument } from './open-in-place';

const here = new URL('https://liveknowledge.app/document/kb-1#t=tab-1');

function fakeWin(at: URL = here) {
  const location = {
    href: at.href,
    origin: at.origin,
    pathname: at.pathname,
    search: at.search,
  } as Location & {
    reload: () => void;
  };
  location.reload = vi.fn();
  const history = {
    replaceState: vi.fn((_s: unknown, _t: string, url: string) => {
      const u = new URL(url);
      Object.assign(location, { href: u.href, pathname: u.pathname, search: u.search });
    }),
  } as unknown as History;
  return { location, history };
}

const click = (over: Partial<MouseEvent> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  preventDefault: vi.fn(),
  ...over,
});

describe('sameDocument', () => {
  it('is this page but for its fragment', () => {
    expect(sameDocument('/document/kb-1#t=tab-2&el=e1&open=comments', here)).toBe(true);
    expect(sameDocument('https://liveknowledge.app/document/kb-1', here)).toBe(true);
    expect(sameDocument('/document/kb-1/#t=tab-2', here)).toBe(true);
  });

  it('is not another item, another app, or another query', () => {
    expect(sameDocument('/document/kb-2#t=tab-2', here)).toBe(false);
    expect(sameDocument('https://liveplanner.app/project/kb-1#t=tab-2', here)).toBe(false);
    expect(sameDocument('/document/kb-1?s=code#t=tab-2', here)).toBe(false);
  });
});

describe('openInPlace', () => {
  it('loads the open item’s place in full, in place of the current history entry', () => {
    const win = fakeWin();
    const e = click();
    expect(openInPlace(e, '/document/kb-1#t=tab-2&el=e1&open=comments', win)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(win.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      'https://liveknowledge.app/document/kb-1#t=tab-2&el=e1&open=comments',
    );
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads as it is when the address is already the place', () => {
    const win = fakeWin();
    expect(openInPlace(click(), here.href, win)).toBe(true);
    expect(win.history.replaceState).not.toHaveBeenCalled();
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves another item, another app and a new-tab click to the link', () => {
    for (const [href, over] of [
      ['/document/kb-2#t=tab-2', {}],
      ['https://liveplanner.app/project/p-1#t=tab-2', {}],
      ['/document/kb-1#t=tab-2', { metaKey: true }],
      ['/document/kb-1#t=tab-2', { ctrlKey: true }],
      ['/document/kb-1#t=tab-2', { button: 1 }],
      ['/document/kb-1#t=tab-2', { defaultPrevented: true }],
    ] as const) {
      const win = fakeWin();
      const e = click(over);
      expect(openInPlace(e, href, win)).toBe(false);
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(win.location.reload).not.toHaveBeenCalled();
    }
  });
});
