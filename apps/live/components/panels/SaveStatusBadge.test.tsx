// @vitest-environment jsdom

// The Activity panel's save badge (docs/specs/006-diagram/per-tab-storage.md): one label per failed-save
// cause, each announced as a status.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { SaveStatusBadge } from './activity-panel-parts';

function badge(status: SaveStatus): string | null {
  const { unmount } = render(<SaveStatusBadge status={status} savedAt={null} />);
  const text = screen.queryByRole('status')?.textContent ?? null;
  unmount();
  return text;
}

describe('SaveStatusBadge', () => {
  it('labels each failed-save cause by what actually went wrong', () => {
    expect(badge('error')).toBe('Not saved');
    expect(badge('unauthenticated')).toBe('Signed out');
    expect(badge('forbidden')).toBe('No access');
  });

  it('shows no failure badge while all is well', () => {
    expect(badge('idle')).toBeNull();
    expect(badge('saved')).toBeNull();
  });
});
