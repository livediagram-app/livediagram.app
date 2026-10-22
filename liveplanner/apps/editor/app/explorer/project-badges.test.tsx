// @vitest-environment jsdom

// A project's visibility badge: the word beside its icon, or only the icon
// in minimal chrome (power user mode), its name kept for assistive technology.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VisibilityBadge } from './project-badges';
import type { PaneProject } from './views';

afterEach(cleanup);

const PRIVATE = { id: 'd', name: 'Plan', ownerId: 'me', savedAt: 1 } as unknown as PaneProject;

describe('VisibilityBadge', () => {
  it('shows the word by default', () => {
    render(<VisibilityBadge project={PRIVATE} />);
    const word = screen.getByText('Private');
    expect(word.className).not.toContain('sr-only');
  });

  it('shows only the lock when icon-only, still named and reachable by keyboard', () => {
    render(<VisibilityBadge project={PRIVATE} iconOnly />);
    const word = screen.getByText('Private');
    expect(word.className).toContain('sr-only');
    expect(word.parentElement!.getAttribute('tabindex')).toBe('0');
  });
});

describe('VisibilityBadge on a project in this browser', () => {
  it('leaves the state to the This Browser pill (docs/specs/006-project/offline-mode.md#this-browser-pill)', () => {
    const local = { ...PRIVATE, ownerId: 'offline' } as PaneProject;
    const { container } = render(<VisibilityBadge project={local} />);
    expect(container.textContent).toBe('');
  });
});
