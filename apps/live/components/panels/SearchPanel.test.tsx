// @vitest-environment jsdom

// A search result for a document saved only in this browser carries the Local only pill as a
// plain label (docs/specs/006-document/offline-mode.md#local-only-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ONLY_DESCRIPTION } from '@/components/primitives/LocalOnlyPill';
import { SearchPanel } from './SearchPanel';

afterEach(cleanup);

describe('SearchPanel', () => {
  it('labels a Local only document result, with what it means', () => {
    render(
      <SearchPanel
        documents={[
          { id: 'l1', name: 'Workshop notes', localOnly: true },
          { id: 'c1', name: 'Cloud plan' },
        ]}
        folders={[]}
        onSelectDocument={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const local = screen.getByRole('button', { name: /Workshop notes/ });
    expect(local.textContent).toContain('Local only');
    expect(local.textContent).toContain(LOCAL_ONLY_DESCRIPTION);
    expect(local.querySelector('a')).toBeNull();
    expect(screen.getByRole('button', { name: /Cloud plan/ }).textContent).not.toContain(
      'Local only',
    );
  });
});
