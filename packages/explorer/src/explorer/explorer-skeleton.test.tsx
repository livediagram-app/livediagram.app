// The Explorer's skeleton, while the host finds out who is here (liveworkspace/docs/specs/010-site/site.md "The
// Explorer"), and the small text links' tap areas.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExplorerSkeleton } from '../index';
import { EXPLORER_MAIN, SECTION_LINK } from '../ui/classes';

describe('ExplorerSkeleton', () => {
  it('is busy, says so to a screen reader, and lays out as the Explorer’s own body does', () => {
    render(<ExplorerSkeleton />);
    const main = screen.getByRole('main');
    expect(main.getAttribute('aria-busy')).toBe('true');
    expect(main.className).toBe(EXPLORER_MAIN);
    expect(screen.getByRole('status').textContent).toBe('Loading the Explorer');
    // The shapes are decoration: nothing in them is read out.
    for (const part of main.querySelectorAll(':scope > div')) {
      expect(part.getAttribute('aria-hidden')).toBe('true');
    }
    expect(main.querySelectorAll('.h-48')).toHaveLength(6);
  });
});

describe('section links', () => {
  it('reach a finger’s 44px on a touch screen (See All, See Timeline)', () => {
    expect(SECTION_LINK.split(' ')).toEqual(expect.arrayContaining(['relative', 'touch-target']));
  });
});
