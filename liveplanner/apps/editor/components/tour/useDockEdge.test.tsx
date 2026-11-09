// @vitest-environment jsdom

// A phone's mission strip never covers the control it names (docs/specs/026-plan/plan-tour.md "Never over what it
// names"; owner, 2026-11-09: the Card Types track said to press Types while its strip covered Types).

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modalClosed, modalOpened, openModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import { covered, firstDrawn } from './ring-target';
import { useDockEdge } from './useDockEdge';
import { useMissions, type Mission } from './missions';

const phone = vi.hoisted(() => ({ on: true }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => phone.on,
}));
vi.mock('@liveworkspace/workbench/components/tour/tour-reveal', () => ({
  revealInScrollers: vi.fn(() => true),
}));
import { MissionStrip } from './MissionStrip';

const VH = 844;
const box = (top: number, height = 44, left = 200, width = 44) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
function place(id: string, rect: DOMRect, role?: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  if (role) el.setAttribute('role', role);
  el.getBoundingClientRect = () => rect;
  document.body.append(el);
  return el;
}
// A sheet 160px tall, as the strip measures it.
const sheetRef = () => {
  const ref = createRef<HTMLElement>() as { current: HTMLElement | null };
  const sheet = document.createElement('div');
  Object.defineProperty(sheet, 'offsetHeight', { value: 160 });
  ref.current = sheet;
  return ref;
};

beforeEach(() => {
  phone.on = true;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VH });
});
afterEach(() => {
  cleanup();
  while (openModalCount() > 0) modalClosed();
  document.body.innerHTML = '';
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

describe('ring-target', () => {
  it('never counts the strip itself as covering a control, but does count a window over it', () => {
    const target = place('types', box(715));
    const layer = document.createElement('div');
    layer.setAttribute('data-mission-strip-layer', '');
    const inStrip = document.createElement('span');
    layer.append(inStrip);
    document.body.append(layer);
    const dialog = place('dialog', box(0, VH, 0, 390), 'dialog');
    let hit: Element = inStrip;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    expect(covered(target, target.getBoundingClientRect())).toBe(false);
    expect(firstDrawn(['#types'])?.top).toBe(715);
    hit = dialog;
    expect(covered(target, target.getBoundingClientRect())).toBe(true);
    expect(firstDrawn(['#types'])).toBeNull();
  });
});

describe('useDockEdge', () => {
  const hook = (props: Partial<Parameters<typeof useDockEdge>[0]> = {}) =>
    renderHook((p: Parameters<typeof useDockEdge>[0]) => useDockEdge(p), {
      initialProps: {
        on: true,
        ring: '#target',
        sheetRef: sheetRef(),
        prefer: 'bottom' as const,
        bottomInset: 48,
        ...props,
      },
    });

  it('docks at the top while the named control sits where the bottom sheet would (Types, bottom right)', () => {
    place('target', box(715));
    expect(hook().result.current).toBe('top');
  });

  it('stays at the bottom for a control mid-screen or at the top', () => {
    place('target', box(300));
    expect(hook().result.current).toBe('bottom');
    document.body.innerHTML = '';
    place('target', box(70));
    expect(hook().result.current).toBe('bottom');
  });

  it('docks at the bottom over a window when the control sits at its top (the type editor’s name)', () => {
    place('target', box(120));
    expect(hook({ prefer: 'top' }).result.current).toBe('bottom');
  });

  it('goes to the top while a sheet up from the bottom is open (a column’s settings), with nothing named', () => {
    place('sheet', box(420, VH - 420, 0, 390), 'dialog');
    expect(hook({ ring: null }).result.current).toBe('top');
  });

  it('follows the control as the page changes, and on a visible viewport resize', () => {
    vi.useFakeTimers();
    const listeners: Record<string, () => void> = {};
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        addEventListener: (t: string, fn: () => void) => (listeners[t] = fn),
        removeEventListener: vi.fn(),
      },
    });
    try {
      const el = place('target', box(300));
      const { result, unmount } = hook();
      expect(result.current).toBe('bottom');
      el.getBoundingClientRect = () => box(715);
      act(() => void vi.advanceTimersByTime(150));
      expect(result.current).toBe('top');
      el.getBoundingClientRect = () => box(300);
      act(() => listeners.resize?.());
      expect(result.current).toBe('bottom');
      unmount();
    } finally {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
      vi.useRealTimers();
    }
  });

  it('measures nothing off a phone: the usual edge stands', () => {
    place('target', box(715));
    expect(hook({ on: false }).result.current).toBe('bottom');
  });
});

describe('MissionStrip on a phone', () => {
  type Ctx = { a: boolean };
  const MISSIONS: Mission<Ctx>[] = [
    {
      id: 'types',
      title: 'Make a Card Type',
      why: 'Open **Types** and add one.',
      lesson: 'Done.',
      points: ['#types'],
      hints: [],
      done: (c) => c.a,
    },
  ];
  function Strip() {
    const run = useMissions({ missions: MISSIONS, ctx: { a: false }, active: true });
    return <MissionStrip name="Card Types" run={run} onEnd={() => {}} finish={null} />;
  }
  const edge = () =>
    document.querySelector('[data-mission-strip-layer]')?.getAttribute('data-mission-edge');
  // The strip's sheet, 160px tall as a phone draws it (jsdom lays nothing out).
  beforeEach(() => {
    const h = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160);
    return () => h.mockRestore();
  });

  it('docks at the top, clear of Types, and rings Types', () => {
    place('types', box(715));
    render(<Strip />);
    expect(edge()).toBe('top');
    const layer = document.querySelector<HTMLElement>('[data-mission-strip-layer]')!;
    expect(layer.style.top).toBe('0px');
    expect(document.querySelector('[data-hint-ring]')).not.toBeNull();
  });

  it('stays above the footer when Types is clear of it, and at the top over a window', () => {
    place('types', box(300));
    const { unmount } = render(<Strip />);
    expect(edge()).toBe('bottom');
    unmount();
    act(() => modalOpened());
    render(<Strip />);
    expect(edge()).toBe('top');
  });

  it('carries no edge off a phone', () => {
    phone.on = false;
    place('types', box(715));
    render(<Strip />);
    expect(edge()).toBeNull();
  });
});
