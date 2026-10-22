// @vitest-environment jsdom
// HYPERLINK cells in the grid (docs/specs/029-sheets/formulas.md "Text"): drawn as a link, Ctrl/⌘ and a click opens
// the allowed target in a new tab while a plain click only selects, the pointer's tooltip says where it goes, and a
// disallowed target is plain text that never opens.
import { act, fireEvent, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cellPoint, installGridDom, mountGrid } from './sheet-grid-test-utils';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

let restore: () => void;
const open = vi.fn();
beforeAll(() => {
  restore = installGridDom();
});
afterAll(() => restore());
beforeEach(() => {
  open.mockReset();
  track.mockReset();
  vi.stubGlobal('open', open);
});

const LINK = '=HYPERLINK("https://livediagram.app", "livediagram")';
const textOf = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-sheet-text]')].find(
    (el) => el.textContent === label,
  )!;

describe('a HYPERLINK cell', () => {
  it('draws its label underlined, as a link', async () => {
    await mountGrid({ cells: { A1: LINK, A2: 'plain' } });
    expect(textOf('livediagram').style.textDecoration).toBe('underline');
    expect(textOf('plain').style.textDecoration).toBe('');
  });

  it('opens on Ctrl or ⌘ and a click, in a new tab with no opener', async () => {
    const h = await mountGrid({ cells: { A1: LINK } });
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(0, 0), metaKey: true });
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(0, 0), ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('https://livediagram.app/', '_blank', 'noopener,noreferrer');
    expect(track).toHaveBeenCalledWith('Sheet', 'Opened', 'Hyperlink');
  });

  it('only selects on a plain click', async () => {
    const h = await mountGrid({ cells: { B2: LINK } });
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(1, 1) });
    fireEvent.pointerUp(window, cellPoint(1, 1));
    expect(open).not.toHaveBeenCalled();
    expect(h.c().selection.active).toEqual({ r: 1, c: 1 });
  });

  it('never opens a disallowed target, which draws as plain text', async () => {
    const h = await mountGrid({ cells: { A1: '=HYPERLINK("javascript:alert(1)", "bad")' } });
    expect(textOf('bad').style.textDecoration).toBe('');
    fireEvent.pointerDown(h.viewport, { button: 0, ...cellPoint(0, 0), metaKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('says where it goes, and how to open it, under the pointer', async () => {
    const h = await mountGrid({ cells: { A1: LINK } });
    act(() => {
      fireEvent.pointerMove(h.viewport, cellPoint(0, 0));
    });
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('https://livediagram.app/');
    expect(tip.textContent).toMatch(/(⌘|Ctrl\+)Click to open/);
  });
});
