// @vitest-environment jsdom

// A document's visibility badge: the word beside its icon, or only the icon
// in minimal chrome (power user mode), its name kept for assistive technology.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCommunityEnabledForTests } from '@livediagram/ui';
import { VisibilityBadge } from './document-badges';
import type { PaneDocument } from './views';

afterEach(cleanup);

const PRIVATE = { id: 'd', name: 'Plan', ownerId: 'me', savedAt: 1 } as unknown as PaneDocument;

describe('VisibilityBadge', () => {
  it('shows the word by default', () => {
    render(<VisibilityBadge document={PRIVATE} />);
    const word = screen.getByText('Private');
    expect(word.className).not.toContain('sr-only');
  });

  it('shows only the lock when icon-only, still named and reachable by keyboard', () => {
    render(<VisibilityBadge document={PRIVATE} iconOnly />);
    const word = screen.getByText('Private');
    expect(word.className).toContain('sr-only');
    expect(word.parentElement!.getAttribute('tabindex')).toBe('0');
  });
});

describe('VisibilityBadge on a document in this browser', () => {
  it('leaves the state to the Local only pill (docs/specs/006-document/offline-mode.md#local-only-pill)', () => {
    const local = { ...PRIVATE, ownerId: 'offline' } as PaneDocument;
    const { container } = render(<VisibilityBadge document={local} />);
    expect(container.textContent).toBe('');
  });
});

// A document listed in the public Community (docs/specs/025-community/community.md "In the Explorer").
describe('VisibilityBadge on a Community-listed document', () => {
  afterEach(() => {
    resetCommunityEnabledForTests();
    vi.unstubAllGlobals();
  });

  const capabilities = (communityEnabled: boolean) =>
    vi.fn(async () => new Response(JSON.stringify({ communityEnabled }), { status: 200 }));

  it('reads Public, winning over Shared', () => {
    vi.stubGlobal('fetch', capabilities(true));
    const listed = { ...PRIVATE, shareCode: 'abc', communityListed: true } as PaneDocument;
    render(<VisibilityBadge document={listed} />);
    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.queryByText('Shared')).toBeNull();
  });

  it('falls back to the document otherwise reads while the Community is off', async () => {
    vi.stubGlobal('fetch', capabilities(false));
    const listed = { ...PRIVATE, shareCode: 'abc', communityListed: true } as PaneDocument;
    render(<VisibilityBadge document={listed} />);
    expect(await screen.findByText('Shared')).toBeTruthy();
    expect(screen.queryByText('Public')).toBeNull();
  });

  it('asks nothing for an unlisted row', () => {
    const fetchSpy = capabilities(true);
    vi.stubGlobal('fetch', fetchSpy);
    render(<VisibilityBadge document={PRIVATE} />);
    expect(screen.getByText('Private')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
