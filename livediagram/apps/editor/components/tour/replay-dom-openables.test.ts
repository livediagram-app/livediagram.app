// @vitest-environment jsdom

// Watch It Built's hands on the chrome (replay-dom.ts): a category on the bar and a group on a flyout's rail are held
// open by pressing their own buttons, and closed newest first, so a rail is put back on its first group before its
// flyout closes over it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdOpen, HOLD_OPEN_FRAMES, OPENABLES, syncOpen } from './replay-dom';

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

// Marker 2 on the dock (DockToolbar.tsx DockButton): a press opens its flyout only while it reads as in hand, which the
// dock draws a render after the replay's frame puts the pen there.
function mountMarker(log: string[]) {
  const dock = document.createElement('div');
  dock.setAttribute('data-whiteboard-dock', '');
  const button = document.createElement('button');
  button.setAttribute('data-dock-item', 'second');
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    log.push('press');
    const flyout = document.createElement('div');
    flyout.id = 'whiteboard-flyout-second';
    document.body.append(flyout);
  });
  dock.append(button);
  document.body.append(dock);
  return button;
}

describe('holdOpen (Work Tracker #668)', () => {
  // Animation frames run by hand.
  let frames: FrameRequestCallback[] = [];
  const runFrame = () => {
    const due = frames;
    frames = [];
    due.forEach((f) => f(0));
  };
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      if (id > 0) frames.splice(id - 1, 1);
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('presses the marker again once the dock draws it in hand, with no clock to call it (reduced motion)', () => {
    const log: string[] = [];
    const marker = mountMarker(log);
    holdOpen(['dock-pen-second'], new Set());
    // Not in hand yet: never pressed, so the pen is never picked up for real.
    expect(log).toEqual([]);
    runFrame();
    expect(log).toEqual([]);
    marker.setAttribute('aria-pressed', 'true');
    runFrame();
    expect(log).toEqual(['press']);
    expect(OPENABLES['dock-pen-second']!.isOpen()).toBe(true);
    // Open: nothing more is asked for.
    expect(frames).toEqual([]);
  });

  it('gives up after its frames, and its stop cancels the next try', () => {
    const log: string[] = [];
    mountMarker(log);
    holdOpen(['dock-pen-second'], new Set());
    for (let i = 0; i < HOLD_OPEN_FRAMES; i++) runFrame();
    expect(frames).toEqual([]);
    const stop = holdOpen(['dock-pen-second'], new Set());
    expect(frames).toHaveLength(1);
    stop();
    expect(frames).toEqual([]);
    expect(log).toEqual([]);
  });

  it('asks for no frame when everything named is already open', () => {
    const log: string[] = [];
    mountBar(log);
    holdOpen(['bar-session'], new Set());
    expect(log).toEqual(['open']);
    expect(frames).toEqual([]);
  });
});
