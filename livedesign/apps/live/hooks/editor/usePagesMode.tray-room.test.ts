// @vitest-environment jsdom

// A page framed while a template's example content tray shows keeps clear of it, and the tray going (Clear Example
// Content, Keep It) never moves the page: the snap as the view rests keeps the room the page was framed with, and
// only the next explicit frame reclaims it (liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md).

import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagesOf, layOutPages, type Tab } from '@livedesign/design';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

type SnapOptions = { fitOf: (page: unknown) => { zoom: number; offset: { x: number; y: number } } };
const snap = vi.hoisted(() => ({ options: null as unknown }));
vi.mock('./usePageSnap', async (original) => ({
  ...(await original<typeof import('./usePageSnap')>()),
  usePageSnap: (options: unknown) => {
    snap.options = options;
  },
}));

const box = (el: HTMLElement, top: number, bottom: number) => {
  el.getBoundingClientRect = () =>
    ({ left: 0, right: 1200, width: 1200, top, bottom, height: bottom - top }) as DOMRect;
  return el;
};
const node = (attrs: Record<string, string>, top: number, bottom: number) => {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(box(el, top, bottom));
  return el;
};

afterEach(() => document.body.replaceChildren());

function mount() {
  const canvas = box(document.createElement('main'), 0, 800);
  Object.defineProperty(canvas, 'offsetWidth', { value: 1200 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  document.body.append(canvas);
  const setViewportZoom = vi.fn();
  const setViewportOffset = vi.fn();
  const frameFirstPageRef = { current: null as (() => void) | null };
  const tab = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [{ id: 'p1', size: 'a4' }],
  } as unknown as Tab;
  renderHook(() =>
    usePagesMode({
      activeTab: tab,
      canEdit: true,
      tabLoaded: true,
      commitTabs: vi.fn(),
      canvasMainRef: { current: canvas },
      setViewportZoom,
      setViewportOffset,
      getViewport: () => ({ zoom: 1, offset: { x: 0, y: 0 } }),
      clearSelection: vi.fn(),
      toastInfo: vi.fn(),
      frameFirstPageRef,
    }),
  );
  const framed = () => {
    setViewportOffset.mockClear();
    frameFirstPageRef.current!();
    return setViewportOffset.mock.lastCall![0] as { x: number; y: number };
  };
  const page = layOutPages(pagesOf(tab))[0]!;
  const settled = () => (snap.options as SnapOptions).fitOf(page).offset;
  return { framed, settled };
}

describe('the example content tray and a framed page', () => {
  it('frames the page lower while the tray shows', () => {
    const h = mount();
    node({ 'data-toolbar-palette': '' }, 10, 60);
    const stripOnly = h.framed();
    const tray = node({ 'data-palette-tray': '', 'data-yields-to-mode': '' }, 66, 100);
    expect(h.framed().y).toBeGreaterThan(stripOnly.y);
    tray.remove();
  });

  it('keeps the page where it is as the tray goes, until the next explicit frame', () => {
    const h = mount();
    node({ 'data-toolbar-palette': '' }, 10, 60);
    const tray = node({ 'data-palette-tray': '', 'data-yields-to-mode': '' }, 66, 100);
    const withTray = h.framed();
    tray.remove();
    // The view resting after the press on Clear Example Content: the snap's frame is the one the page has.
    expect(h.settled()).toEqual(withTray);
    // Fit (Shift+1, the zoom menu, a page's label) reclaims the room.
    const reclaimed = h.framed();
    expect(reclaimed.y).toBeLessThan(withTray.y);
    expect(h.settled()).toEqual(reclaimed);
  });
});
