// @vitest-environment jsdom

// The Bring Focus invitation's promise (docs/specs/012-collaboration/bring-focus.md): a point keeps your zoom,
// a page of a Pages tab is fitted to your screen ("On a page"), so the copy says which.

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

  it('promises the page fitted to your screen for a page', () => {
    render(<FocusInviteDialog from="Sam" toPage onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/the page they are pointing at, fitted to your screen/)).toBeTruthy();
    expect(screen.queryByText(/keeping your zoom/)).toBeNull();
  });

  it('renders nothing without an invitation', () => {
    render(<FocusInviteDialog from={null} toPage onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/wants you to look/)).toBeNull();
  });
});
