// @vitest-environment jsdom

// The editor header's badge for a document saved only in this browser reads "Local only", matching
// the Explorer's pill (docs/specs/006-document/offline-mode.md#local-only-badge--explorer).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY_DESCRIPTION, LOCAL_ONLY_LABEL } from '@/components/primitives/LocalOnlyPill';
import { SharedBadge } from './SharedBadge';

afterEach(cleanup);

describe('SharedBadge', () => {
  it('reads Local only for a document in this browser, never Offline', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(LOCAL_ONLY_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.textContent).toContain('Local only');
    expect(badge.textContent).not.toContain('Offline');
  });

  it('carries an icon beside the words, not colour alone', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(LOCAL_ONLY_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('is named Local only and described with the pill sentence', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(LOCAL_ONLY_LABEL).closest('[tabindex]') as HTMLElement;
    expect(badge.getAttribute('aria-label')).toBe(LOCAL_ONLY_LABEL);
    const id = badge.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe(LOCAL_ONLY_DESCRIPTION);
  });

  it('explains it in the legend on focus', () => {
    render(<SharedBadge shareable={false} offline />);
    const badge = screen.getByText(LOCAL_ONLY_LABEL).closest('[tabindex]') as HTMLElement;
    fireEvent.focus(badge);
    expect(screen.getAllByText(LOCAL_ONLY_DESCRIPTION).length).toBeGreaterThan(1);
  });

  it('keeps the other states named and described the same way', () => {
    render(<SharedBadge shareable={false} />);
    const badge = screen.getByText('Private').closest('[tabindex]') as HTMLElement;
    expect(badge.getAttribute('aria-label')).toBe('Private');
    const id = badge.getAttribute('aria-describedby');
    expect(document.getElementById(id!)?.textContent).toBe('Only visible to you.');
  });
});

// docs/specs/025-community/community.md: listed in the Community, the document is public.
describe('SharedBadge in the Community', () => {
  it('reads Public while listed, over Shared, and Local only still wins', () => {
    render(<SharedBadge shareable community />);
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText('Shared')).toBeNull();
    cleanup();
    render(<SharedBadge shareable={false} offline community />);
    expect(screen.getByText(LOCAL_ONLY_LABEL)).toBeTruthy();
    expect(screen.queryByText('Public')).toBeNull();
  });
});

// docs/specs/006-document/offline-mode.md "The visibility legend": the reach scale, the hover preview and
// Change Who Can See This.
describe('SharedBadge legend', () => {
  it('marks the current audience on the scale', () => {
    render(<SharedBadge shareable />);
    fireEvent.focus(screen.getByText('Shared').closest('[tabindex]')!);
    const legend = document.querySelector('[data-visibility-legend]')!;
    expect(legend.querySelector('[data-current]')?.textContent).toBe('Link');
    expect(legend.querySelector('[data-legend-hero]')?.getAttribute('data-legend-hero')).toBe(
      'shared',
    );
  });

  it('shows a hovered audience in the hero, then puts the current one back', () => {
    render(<SharedBadge shareable={false} />);
    fireEvent.focus(screen.getByText('Private').closest('[tabindex]')!);
    const legend = document.querySelector('[data-visibility-legend]')!;
    const hero = () => legend.querySelector('[data-legend-hero]')!;
    fireEvent.mouseEnter(screen.getByText('Everyone').closest('li')!);
    expect(hero().getAttribute('data-legend-hero')).toBe('community');
    expect(hero().textContent).toContain('If It Were');
    fireEvent.mouseLeave(screen.getByText('Everyone').closest('ol')!);
    expect(hero().getAttribute('data-legend-hero')).toBe('private');
    expect(hero().textContent).toContain('Who Can See This');
  });

  it('opens Share from the pill and from the legend when the reader may share', () => {
    const onManage = vi.fn();
    render(<SharedBadge shareable={false} onManage={onManage} />);
    const pill = screen.getByRole('button', { name: 'Private' });
    expect(pill.getAttribute('aria-describedby')).toBeTruthy();
    fireEvent.click(pill);
    expect(onManage).toHaveBeenCalledTimes(1);
    fireEvent.focus(pill);
    fireEvent.click(screen.getByText('Change Who Can See This'));
    expect(onManage).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-visibility-legend]')).toBeNull();
  });

  it('offers no change to a reader who may not share', () => {
    render(<SharedBadge shareable={false} />);
    expect(screen.queryByRole('button', { name: 'Private' })).toBeNull();
    fireEvent.focus(screen.getByText('Private').closest('[tabindex]')!);
    expect(screen.queryByText('Change Who Can See This')).toBeNull();
  });
});
