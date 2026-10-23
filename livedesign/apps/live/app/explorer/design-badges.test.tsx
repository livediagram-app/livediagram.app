// @vitest-environment jsdom

// A design's visibility badge: the word beside its icon, or only the icon
// in minimal chrome (power user mode), its name kept for assistive technology.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VisibilityBadge } from './design-badges';
import type { PaneDesign } from './views';

afterEach(cleanup);

const PRIVATE = { id: 'd', name: 'Plan', ownerId: 'me', savedAt: 1 } as unknown as PaneDesign;

describe('VisibilityBadge', () => {
  it('shows the word by default', () => {
    render(<VisibilityBadge design={PRIVATE} />);
    const word = screen.getByText('Private');
    expect(word.className).not.toContain('sr-only');
  });

  it('shows only the lock when icon-only, still named and reachable by keyboard', () => {
    render(<VisibilityBadge design={PRIVATE} iconOnly />);
    const word = screen.getByText('Private');
    expect(word.className).toContain('sr-only');
    expect(word.parentElement!.getAttribute('tabindex')).toBe('0');
  });
});

describe('VisibilityBadge on a design in this browser', () => {
  it('leaves the state to the This Browser pill (docs/specs/006-design/offline-mode.md#this-browser-pill)', () => {
    const local = { ...PRIVATE, ownerId: 'offline' } as PaneDesign;
    const { container } = render(<VisibilityBadge design={local} />);
    expect(container.textContent).toBe('');
  });
});
