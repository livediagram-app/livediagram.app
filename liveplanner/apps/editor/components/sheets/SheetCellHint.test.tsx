// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SheetCellHint } from './SheetCellHint';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')!;

// The grid (the hint's offset parent) fills a 390 x 844 phone from its top-left corner.
function onPhone(hint: DOMRect) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute('role') === 'tooltip' ? hint : rect(0, 0, 390, 844);
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
});

describe('SheetCellHint', () => {
  it('says why a cell is an error, under the cell, capped at the screen', () => {
    onPhone(rect(40, 62, 120, 20));
    render(<SheetCellHint left={40} top={62} cellHeight={20} error="#DIV/0!" link={null} />);
    const hint = screen.getByRole('tooltip');
    expect(hint.textContent).toBe('#DIV/0!');
    expect(hint.style.transform).toBe('');
    expect(hint.style.maxWidth).toMatch(/^min\(16rem, /);
  });

  it('slides a link hint from a cell near the right of a phone back on screen', () => {
    onPhone(rect(300, 62, 220, 34));
    render(
      <SheetCellHint left={300} top={62} cellHeight={20} error={null} link="https://a.example" />,
    );
    const hint = screen.getByRole('tooltip');
    expect(hint.textContent).toContain('https://a.example');
    expect(hint.textContent).toContain('to open');
    expect(hint.style.transform).toBe('translate(-138px)');
  });

  it('flips above a cell at the foot of the screen', () => {
    // The cell runs 790 to 810; the hint, 2px under it, would end at 846.
    onPhone(rect(40, 812, 120, 34));
    render(<SheetCellHint left={40} top={812} cellHeight={20} error="#REF!" link={null} />);
    expect(screen.getByRole('tooltip').style.transform).toBe('translate(0px, -58px)');
  });
});
