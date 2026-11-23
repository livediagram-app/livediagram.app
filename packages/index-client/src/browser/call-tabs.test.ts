import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusOrOpen, isBlank, nameItemTab, sendTab, viaSilentSignIn } from './call-tabs';
import { fakeWindow } from './fake-window';

// The call's own tab (liveworkspace/docs/specs/004-index/item-calls.md "Starting"): a blank tab of ours is sent on with
// its opener cut; one already elsewhere (another origin, whose location throws) is only focused.

const blank = () => ({ location: { href: 'about:blank' }, opener: {} as unknown, focus: vi.fn() });
const elsewhere = () => ({
  get location(): never {
    throw new Error('cross-origin');
  },
  focus: vi.fn(),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('call tabs', () => {
  it('sends a blank tab to the call, cutting its opener', () => {
    const { win } = fakeWindow();
    const tab = blank();
    win.open = vi.fn().mockReturnValue(tab);
    expect(focusOrOpen('lw-call-d1', 'https://huddle.test/s/a')).toBe(true);
    expect(win.open).toHaveBeenCalledWith('', 'lw-call-d1');
    expect(tab.location.href).toBe('https://huddle.test/s/a');
    expect(tab.opener).toBeNull();
    expect(tab.focus).not.toHaveBeenCalled();
  });

  it('focuses a tab already in the call, and answers false when blocked', () => {
    const { win } = fakeWindow();
    const tab = elsewhere();
    win.open = vi.fn().mockReturnValue(tab);
    expect(isBlank(tab as unknown as Window)).toBe(false);
    expect(focusOrOpen('lw-call-d1', 'https://huddle.test/s/a')).toBe(true);
    expect(tab.focus).toHaveBeenCalled();
    win.open = vi.fn().mockReturnValue(null);
    expect(focusOrOpen('lw-call-d1', 'https://huddle.test/s/a')).toBe(false);
  });

  it('still sends a tab whose opener is read-only', () => {
    const tab = {
      location: { href: 'about:blank' },
      set opener(_v: unknown) {
        throw new Error('read-only');
      },
    };
    sendTab(tab as unknown as Window, 'https://huddle.test/s/b');
    expect(tab.location.href).toBe('https://huddle.test/s/b');
  });

  it('sends a share link through the no-click sign-in first, anything else as it is', () => {
    const tab = blank();
    sendTab(tab as unknown as Window, 'https://huddle.test/document/shared?s=AB12#t=x');
    expect(tab.location.href).toBe(
      'https://huddle.test/api/auth/silent?return=%2Fdocument%2Fshared%3Fs%3DAB12%23t%3Dx',
    );
    expect(viaSilentSignIn('https://huddle.test/document/d1')).toBe(
      'https://huddle.test/document/d1',
    );
    expect(viaSilentSignIn('not a url')).toBe('not a url');
  });

  it("names the item's tab, never over a name of the page's own", () => {
    const { win } = fakeWindow();
    win.name = '';
    nameItemTab('d1');
    expect(win.name).toBe('lw-item-d1');
    nameItemTab('d2');
    expect(win.name).toBe('lw-item-d2');
    win.name = 'their-own';
    nameItemTab('d3');
    expect(win.name).toBe('their-own');
  });
});
