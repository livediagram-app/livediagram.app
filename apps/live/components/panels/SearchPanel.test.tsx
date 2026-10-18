// @vitest-environment jsdom

// A search result for a document saved only in this browser carries the This Browser pill as a
// plain label (docs/specs/006-document/offline-mode.md#this-browser-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { THIS_BROWSER_DESCRIPTION } from '@/components/primitives/ThisBrowserPill';
import { SearchPanel } from './SearchPanel';

afterEach(cleanup);

describe('SearchPanel', () => {
  it('labels a document in This Browser result, with what it means', () => {
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
    expect(local.textContent).toContain('This Browser');
    expect(local.textContent).toContain(THIS_BROWSER_DESCRIPTION);
    expect(local.querySelector('a')).toBeNull();
    expect(screen.getByRole('button', { name: /Cloud plan/ }).textContent).not.toContain(
      'This Browser',
    );
  });
});
