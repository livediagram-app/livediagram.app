// @vitest-environment jsdom

// Watch It Built's hands on the chrome (replay-dom.ts): a category on the bar and a group on a flyout's rail are held
// open by pressing their own buttons, and closed newest first, so a rail is put back on its first group before its
// flyout closes over it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPENABLES, syncOpen } from './replay-dom';

// jsdom lays nothing out: every node counts as on screen.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 10,
    height: 10,
  } as DOMRect);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// A bar button that toggles its own aria-expanded, and, while open, a flyout with a rail of three groups that marks
// the pressed one current (the first when none is).
function mountBar(log: string[]) {
  const button = document.createElement('button');
  button.setAttribute('data-tour-id', 'bar-session');
  button.setAttribute('aria-expanded', 'false');
  let nav: HTMLElement | null = null;
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    log.push(open ? 'open' : 'close');
    if (!open) {
      nav?.remove();
      nav = null;
      return;
    }
    nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'session tools groups');
    for (let i = 1; i <= 3; i++) {
      const row = document.createElement('button');
      if (i === 1) row.setAttribute('aria-current', 'true');
      row.addEventListener('click', () => {
        log.push(`row ${i}`);
        nav!.querySelectorAll('button').forEach((b) => b.removeAttribute('aria-current'));
        row.setAttribute('aria-current', 'true');
      });
      nav.append(row);
    }
    document.body.append(nav);
  });
  document.body.append(button);
}

describe('the bar and rail openables', () => {
  it('opens a bar category by its own button and closes it again', () => {
    const log: string[] = [];
    mountBar(log);
    const bar = OPENABLES['bar-session']!;
    expect(bar.isOpen()).toBe(false);
    bar.toggle();
    expect(bar.isOpen()).toBe(true);
    bar.toggle();
    expect(bar.isOpen()).toBe(false);
    expect(log).toEqual(['open', 'close']);
  });

  it('picks a rail group by its row and puts the rail back on its first group to close it', () => {
    const log: string[] = [];
    mountBar(log);
    OPENABLES['bar-session']!.toggle();
    const react = OPENABLES['session-react']!;
    expect(react.isOpen()).toBe(false);
    react.toggle();
    expect(react.isOpen()).toBe(true);
    react.toggle();
    expect(react.isOpen()).toBe(false);
    expect(OPENABLES['session-tools']!.isOpen()).toBe(true);
    expect(log).toEqual(['open', 'row 3', 'row 1']);
  });

  it('opens in order across frames and closes the newest first', () => {
    const log: string[] = [];
    mountBar(log);
    const opened = new Set<string>();
    syncOpen(['bar-session', 'session-react'], opened);
    syncOpen(['bar-session', 'session-react'], opened);
    expect(OPENABLES['session-react']!.isOpen()).toBe(true);
    syncOpen([], opened);
    expect(log).toEqual(['open', 'row 3', 'row 1', 'close']);
    expect(opened.size).toBe(0);
  });
});
