// @vitest-environment jsdom

// The boundary's tab hugs its title as the title draws (docs/specs/009-elements/boundary.md "Tab"): measured in the
// label's own size, weight and font, with room for the icon, and again once a late webfont (Marker's Shantell Sans)
// lands, so a word never wraps in its tab. Its own file: the face keeps one canvas context for the module's life,
// and this one must be the stub below.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { BoundaryFace } from './BoundaryFace';

const MARKER = "'Shantell Sans', 'Chalkboard SE', cursive";

// A canvas that measures 6 px a character in the fallback face and 8 px once Shantell Sans has landed, doubled for
// a bold weight's extra, and scaled by the px in the font string; it records each font it was asked for.
let landed = false;
const fontsAsked: string[] = [];
const fontListeners = new Set<() => void>();

beforeAll(() => {
  const ctx = {
    font: '',
    measureText(text: string) {
      fontsAsked.push(this.font);
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 14);
      const perChar = (landed && this.font.includes('Shantell') ? 8 : 6) * (px / 14);
      return { width: text.length * perChar + (this.font.startsWith('700') ? 4 : 0) };
    },
  };
  // Every getContext overload is stubbed with the one 2D stand-in.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ctx) as unknown as HTMLCanvasElement['getContext'],
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      status: 'loaded',
      addEventListener: (_: string, fn: () => void) => fontListeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => fontListeners.delete(fn),
    },
  });
});

afterAll(() => {
  vi.restoreAllMocks();
  delete (document as { fonts?: unknown }).fonts;
});

afterEach(() => {
  cleanup();
  landed = false;
  fontsAsked.length = 0;
});

const make = (over: Partial<ShapeElement> = {}) =>
  ({
    ...createShape('boundary', 0, 0),
    width: 400,
    height: 300,
    label: 'Speaking',
    textSize: 'sm',
    textBold: true,
    ...over,
  }) as ShapeElement;

// `font: null` draws the tab with no font of its own.
function show(element: ShapeElement, { font = MARKER }: { font?: string | null } = {}) {
  const fontFamily = font ?? undefined;
  const props = {
    labelNode: <span>{element.label}</span>,
    accent: '#0d9488',
    ink: '#0f172a',
    fontFamily,
    editable: true,
    onSetMeta: () => {},
  };
  const view = render(<BoundaryFace element={element} {...props} />);
  const tab = () =>
    [...view.container.querySelectorAll<HTMLElement>('div[aria-hidden]')].find(
      (d) => d.style.backgroundColor === 'rgb(13, 148, 136)',
    )!;
  // The title's region: the label's wrapper's parent, found once so a typed title still finds it.
  const region = view.getByText(String(element.label)).parentElement!.parentElement!;
  const title = () => region;
  return { tab, title };
}

const px = (v: string) => Number.parseFloat(v);

describe('BoundaryFace title width', () => {
  it('sizes the tab to the title plus its icon, 10 a side', () => {
    const { tab, title } = show(make({ iconId: 'mic' }));
    // "Speaking": 8 chars x 6 + 4 bold = 52, + 2 slack = 54 for the title; the icon is 16 + 6.
    expect(px(title().style.width)).toBe(54);
    expect(px(tab().style.width)).toBe(10 + 22 + 54 + 10);
  });

  it('measures again when a webfont lands, so the title never keeps the fallback face’s width', () => {
    const { tab, title } = show(make({ iconId: 'mic' }));
    expect(px(title().style.width)).toBe(54);
    landed = true;
    act(() => fontListeners.forEach((fn) => fn()));
    // 8 x 8 + 4 + 2 = 70: the tab grew with the face that draws.
    expect(px(title().style.width)).toBe(70);
    expect(px(tab().style.width)).toBe(10 + 22 + 70 + 10);
  });

  it('measures in the label’s own size and weight, not an assumed bold 14', () => {
    const { title } = show(make({ textSize: 'md', textBold: false }));
    expect(fontsAsked.at(-1)).toBe(`400 22px ${MARKER}`);
    // 8 chars x 6 x 22/14, rounded up, + 2.
    expect(px(title().style.width)).toBe(Math.ceil((8 * 6 * 22) / 14) + 2);
  });

  it('grows with each key while the title is typed, and settles back on the label when the edit ends', () => {
    const { title } = show(make());
    const span = screen.getByText('Speaking');
    span.textContent = 'Speaking Room';
    fireEvent.input(span);
    // 13 chars x 6 + 4 + 2.
    expect(px(title().style.width)).toBe(84);
    fireEvent.blur(span);
    expect(px(title().style.width)).toBe(54);
  });

  it('falls back to a system stack when the tab has no font of its own', () => {
    show(make(), { font: null });
    expect(fontsAsked.at(-1)).toBe('700 14px system-ui, sans-serif');
  });
});
