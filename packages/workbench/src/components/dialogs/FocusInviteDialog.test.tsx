// @vitest-environment jsdom

// The Bring Focus invitation's promise (docs/specs/012-collaboration/bring-focus.md): a point keeps your zoom.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusInviteDialog } from './FocusInviteDialog';

vi.mock('next/navigation', () => ({ usePathname: () => '/document/d1' }));

afterEach(cleanup);

describe('FocusInviteDialog', () => {
  it('promises to keep your zoom for a point', () => {
    render(<FocusInviteDialog from="Sam" onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/keeping your zoom/)).toBeTruthy();
  });

  it('renders nothing without an invitation', () => {
    render(<FocusInviteDialog from={null} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/wants you to look/)).toBeNull();
  });
});
