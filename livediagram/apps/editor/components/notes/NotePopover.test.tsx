// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NotePopover, notePopoverBox } from './NotePopover';

// docs/specs/009-elements/rich-text-notes.md "The popover": 416px wide, capped at the viewport less its 8px edge
// margins, so on a phone it stays wholly on screen (Work Tracker 1178).

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

// A box centred `cx` across, at the top of the screen.
const rectAt = (cx: number) => ({ left: cx - 60, width: 120, top: 100, bottom: 160 });

// The drawn edges: the div is translated left by half its width.
const edges = (box: { left: number; width: number }) => ({
  from: box.left - box.width / 2,
  to: box.left + box.width / 2,
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('notePopoverBox', () => {
  it('keeps its 416px width on a desktop', () => {
    expect(notePopoverBox(rectAt(700), DESKTOP)).toEqual({ left: 700, top: 172, width: 416 });
  });

  it('caps its width on a phone and stays wholly on screen, wherever the element is', () => {
    for (const cx of [0, 60, 195, 330, 390]) {
      const box = notePopoverBox(rectAt(cx), PHONE);
      expect(box.width).toBe(374);
      const { from, to } = edges(box);
      expect(from).toBeGreaterThanOrEqual(8);
      expect(to).toBeLessThanOrEqual(PHONE.width - 8);
    }
  });

  it('clamps a near-edge element on a desktop inside the margins', () => {
    const { from, to } = edges(notePopoverBox(rectAt(1430), DESKTOP));
    expect(to).toBe(DESKTOP.width - 8);
    expect(from).toBe(DESKTOP.width - 8 - 416);
  });

  it('flips above the element when there is no room below, never past the top margin', () => {
    expect(notePopoverBox({ left: 640, width: 120, top: 700, bottom: 760 }, DESKTOP).top).toBe(
      700 - 12 - 320,
    );
    expect(notePopoverBox({ left: 640, width: 120, top: 200, bottom: 700 }, DESKTOP).top).toBe(8);
  });

  it('never draws a negative width on a tiny viewport', () => {
    expect(notePopoverBox(rectAt(5), { width: 10, height: 400 }).width).toBe(0);
  });
});

describe('NotePopover on a phone', () => {
  it('draws at the capped width, inside the screen', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(PHONE.width);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(PHONE.height);
    const node = document.createElement('div');
    node.setAttribute('data-element-id', 'title');
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 100, 80, 40));
    document.body.append(node);
    render(
      <NotePopover
        elementId="title"
        initial="Hello"
        readOnly
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const popover = screen.getByText('Note').parentElement as HTMLElement;
    expect(popover.style.width).toBe('374px');
    expect(parseFloat(popover.style.left)).toBe(195);
  });
});
