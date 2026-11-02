// @vitest-environment jsdom
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The deferred fan draws only its front card in the first paint and adds the back two when the browser is idle
// (Work Tracker #268), so a page with a fan on every category card does not carry three SVGs a card in its HTML.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Fan = typeof import('./DeferredPreviewFan').DeferredPreviewFan;

const Preview: ComponentType<{ kind: string }> = ({ kind }) => <svg data-kind={kind} aria-hidden />;

// A fresh module per test: the idle state is the page's, kept in the module.
async function load(): Promise<Fan> {
  vi.resetModules();
  return (await import('./DeferredPreviewFan')).DeferredPreviewFan;
}

const kindsIn = (el: ParentNode) =>
  [...el.querySelectorAll('svg')].map((svg) => svg.getAttribute('data-kind'));

describe('DeferredPreviewFan', () => {
  let host: HTMLElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('puts only the front card in the first paint, the middle of three', async () => {
    const Fan = await load();
    const html = renderToStaticMarkup(<Fan Preview={Preview} kinds={['a', 'b', 'c', 'd']} />);
    const el = document.createElement('div');
    el.innerHTML = html;
    expect(kindsIn(el)).toEqual(['b']);
    // It sits in the front place of the fan (z-10), not the first.
    expect(el.querySelector('span span')!.className).toContain('z-10');
    // The plate is still there, so nothing about the first paint's box changes.
    expect(el.querySelector('[data-optical-ignore]')).not.toBeNull();
  });

  it('puts the one card of a one-template category in its own place, and the front of two', async () => {
    const Fan = await load();
    const one = document.createElement('div');
    one.innerHTML = renderToStaticMarkup(<Fan Preview={Preview} kinds={['solo']} />);
    expect(kindsIn(one)).toEqual(['solo']);
    expect(one.querySelector('span span')!.className).toContain('-rotate-6');
    const two = document.createElement('div');
    two.innerHTML = renderToStaticMarkup(<Fan Preview={Preview} kinds={['a', 'b']} />);
    expect(kindsIn(two)).toEqual(['b']);
    const none = document.createElement('div');
    none.innerHTML = renderToStaticMarkup(<Fan Preview={Preview} kinds={[]} />);
    expect(kindsIn(none)).toEqual([]);
  });

  it('adds the back two when the browser is idle, keeping the front card it drew', async () => {
    let idle: (() => void) | undefined;
    const request = vi.fn((cb: () => void) => {
      idle = cb;
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', request);
    const Fan = await load();
    act(() => root.render(<Fan Preview={Preview} kinds={['a', 'b', 'c']} />));
    expect(kindsIn(host)).toEqual(['b']);
    const front = host.querySelector('svg')!;
    act(() => idle!());
    // In the fan's own order: left, front, right.
    expect(kindsIn(host)).toEqual(['a', 'b', 'c']);
    // The front card is the same element, not redrawn.
    expect(host.querySelector('[data-kind="b"]')).toBe(front);
    // The cards added fade up from nothing; the front one does not.
    const cards = [...host.querySelectorAll('span span')] as HTMLElement[];
    expect(cards.map((c) => c.className.includes('starting:opacity-0'))).toEqual([
      true,
      false,
      true,
    ]);
    // They keep the hover and focus fan of PreviewFan.
    expect(cards[0]!.className).toContain('group-hover:-rotate-9');
    expect(cards[2]!.className).toContain('group-hover:rotate-9');
  });

  it('asks for one idle callback for every fan on the page, with a timeout', async () => {
    const callbacks: (() => void)[] = [];
    const request = vi.fn((cb: () => void, _options?: { timeout: number }) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('requestIdleCallback', request);
    const Fan = await load();
    act(() =>
      root.render(
        <>
          <Fan Preview={Preview} kinds={['a', 'b', 'c']} />
          <Fan Preview={Preview} kinds={['d', 'e', 'f']} />
        </>,
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![1]).toEqual({ timeout: 2000 });
    act(() => callbacks[0]!());
    expect(kindsIn(host)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('waits a moment with a timer where there is no idle callback (Safari)', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const Fan = await load();
    act(() => root.render(<Fan Preview={Preview} kinds={['a', 'b', 'c']} />));
    expect(kindsIn(host)).toEqual(['b']);
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(kindsIn(host)).toEqual(['b']);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(kindsIn(host)).toEqual(['a', 'b', 'c']);
  });

  it('draws a fan mounted after the page is idle whole straight away', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const Fan = await load();
    act(() => root.render(<Fan Preview={Preview} kinds={['a', 'b', 'c']} />));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const later = document.createElement('div');
    document.body.appendChild(later);
    const laterRoot = createRoot(later);
    act(() => laterRoot.render(<Fan Preview={Preview} kinds={['x', 'y', 'z']} />));
    expect(kindsIn(later)).toEqual(['x', 'y', 'z']);
    act(() => laterRoot.unmount());
    later.remove();
  });

  it('stops waiting when it goes before the page is idle', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const Fan = await load();
    act(() => root.render(<Fan Preview={Preview} kinds={['a', 'b', 'c']} />));
    act(() => root.render(null));
    // Nothing left to wake: the timer fires on no one.
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(500);
      }),
    ).not.toThrow();
    expect(host.querySelectorAll('svg')).toHaveLength(0);
  });
});
