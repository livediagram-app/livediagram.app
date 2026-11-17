// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_UNREACHABLE_COPY, AccountUnreachableNotice } from './AccountUnreachableNotice';
import { CORNER_CLUSTER_CLEARANCE } from './corner-cluster-clearance';

afterEach(cleanup);

describe('AccountUnreachableNotice', () => {
  it('says what happened as a polite status, and Try Again asks again', () => {
    const onRetry = vi.fn();
    render(<AccountUnreachableNotice onRetry={onRetry} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(ACCOUNT_UNREACHABLE_COPY.title);
    expect(status.textContent).toContain(ACCOUNT_UNREACHABLE_COPY.body);
    fireEvent.click(screen.getByRole('button', { name: ACCOUNT_UNREACHABLE_COPY.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('reloads the page by default', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    try {
      render(<AccountUnreachableNotice />);
      fireEvent.click(screen.getByRole('button', { name: ACCOUNT_UNREACHABLE_COPY.retry }));
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sits clear of the canvas corner cluster', () => {
    render(<AccountUnreachableNotice onRetry={() => {}} />);
    const cls = screen.getByRole('status').className.split(' ');
    expect(cls).toContain(CORNER_CLUSTER_CLEARANCE);
    expect(cls).not.toContain('bottom-20');
  });
});
