// @vitest-environment jsdom

// The editor header's badge for a document saved only in this browser reads "Local only", matching
// the Explorer's pill (docs/specs/006-document/offline-mode.md#local-only-badge--explorer).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
