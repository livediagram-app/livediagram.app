// @vitest-environment jsdom

// This Browser's Trash rows carry the This Browser pill (docs/specs/006-design/offline-mode.md#this-browser-pill).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrashPane } from './TrashPane';

afterEach(cleanup);

const row = (id: string, name: string) => ({
  id,
  name,
  teamId: null,
  teamName: null,
  trashedAt: Date.now(),
  purgeAt: Date.now() + 86_400_000,
  reason: 'deleted' as const,
});

describe('TrashPane', () => {
  it('marks only the rows in this browser as This Browser', () => {
    render(
      <TrashPane
        trash={{
          listing: { cloud: [row('c1', 'Cloud plan')], local: [row('l1', 'Workshop notes')] },
          restore: vi.fn(),
          purge: vi.fn(),
          empty: vi.fn(),
        }}
      />,
    );
    const pills = screen.getAllByRole('link', { name: /This Browser/ });
    expect(pills).toHaveLength(1);
    expect(pills[0]!.closest('li')?.textContent).toContain('Workshop notes');
  });
});
