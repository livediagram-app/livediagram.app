// @vitest-environment jsdom

// A connected tab's page in every state, for an Editor and for a Participant or Viewer (connected-tabs.md "How it
// looks"): only an Editor removes or connects again; everyone opens again and tries again.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedTabCard } from './ConnectedTabCard';
import type { ConnectedTabView } from './connected-tab-view';

afterEach(cleanup);

const handlers = () => ({ onRemove: vi.fn(), onConnectAgain: vi.fn(), onRetry: vi.fn() });
const show = (view: ConnectedTabView, canEdit: boolean, h = handlers()) => {
  render(
    <ConnectedTabCard view={view} name="Launch plan" app="liveplanner" canEdit={canEdit} {...h} />,
  );
  return h;
};
const button = (name: string) => screen.queryByRole('button', { name });

describe('ConnectedTabCard', () => {
  it('turns the logo and offers nothing while it opens', () => {
    show({ state: 'opening' }, true);
    expect(screen.getByText('Opening Launch plan in liveplanner…')).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('offers Open Again as a new-tab link once opened elsewhere, to every role', () => {
    for (const canEdit of [true, false]) {
      show({ state: 'opened', href: 'https://www.liveplanner.app/s/code' }, canEdit);
      const link = screen.getByRole('link', { name: 'Open Again' });
      expect(link.getAttribute('href')).toBe('https://www.liveplanner.app/s/code');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
      cleanup();
    }
  });

  it('lets an Editor remove a tab whose file is gone', () => {
    const h = show({ state: 'gone' }, true);
    expect(screen.getByText('This file is no longer there.')).toBeTruthy();
    expect(button('Connect Again')).toBeNull();
    fireEvent.click(button('Remove Tab')!);
    expect(h.onRemove).toHaveBeenCalled();
  });

  it('lets an Editor connect again or remove when the link was removed or the tab is a copy', () => {
    for (const state of ['link_removed', 'copy'] as const) {
      const h = show({ state }, true);
      fireEvent.click(button('Connect Again')!);
      fireEvent.click(button('Remove Tab')!);
      expect(h.onConnectAgain).toHaveBeenCalledTimes(1);
      expect(h.onRemove).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('shows a Participant or Viewer why, with no Remove or Connect Again', () => {
    for (const state of ['gone', 'link_removed', 'copy'] as const) {
      show({ state }, false);
      expect(button('Remove Tab')).toBeNull();
      expect(button('Connect Again')).toBeNull();
      cleanup();
    }
    show({ state: 'copy' }, false);
    expect(screen.getByText(/Ask an editor to connect it again/)).toBeTruthy();
  });

  it('says it opens when online, with nothing to press', () => {
    show({ state: 'offline' }, true);
    expect(screen.getByText('Connected files open when you are online.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('lets anyone try again after a failure', () => {
    const h = show({ state: 'failed' }, false);
    fireEvent.click(button('Try Again')!);
    expect(h.onRetry).toHaveBeenCalled();
  });
});
