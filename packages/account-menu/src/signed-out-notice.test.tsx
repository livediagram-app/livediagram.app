import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  noteSignedOutHere,
  SIGNED_OUT_HERE_FRESH_MS,
} from '@liveworkspace/auth-client/signed-out-here';
import { SIGNED_OUT_HERE_BODY, SignedOutHereNotice, signedOutHereTitle } from './signed-out-notice';
import { createSiteAccount } from './site-account';

beforeEach(() => sessionStorage.clear());

// liveworkspace/docs/specs/003-accounts/accounts.md "Signing out", "Signed out of this app only".
describe('SignedOutHereNotice', () => {
  it('says nothing after an ordinary visit or a sign-out of every app', () => {
    const { container } = render(<SignedOutHereNotice app="livediagram" />);
    expect(container.innerHTML).toBe('');
  });

  it('names the app, once, after a sign-out of it alone', () => {
    noteSignedOutHere();
    const { unmount } = render(
      <StrictMode>
        <SignedOutHereNotice app="liveplanner" />
      </StrictMode>,
    );
    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Signed out of liveplanner only');
    expect(notice.textContent).toContain(SIGNED_OUT_HERE_BODY);
    expect(signedOutHereTitle('livehuddle')).toBe('Signed out of livehuddle only');
    unmount();
    // Taken: a reload, or the next page in the tab, says nothing.
    render(<SignedOutHereNotice app="liveplanner" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is never in the static HTML, which cannot know', () => {
    noteSignedOutHere();
    expect(renderToString(<SignedOutHereNotice app="livediagram" />)).toBe('');
  });

  it('ignores a note no page took in time', () => {
    noteSignedOutHere(Date.now() - SIGNED_OUT_HERE_FRESH_MS - 1);
    render(<SignedOutHereNotice app="livediagram" />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('goes with Dismiss, or Escape', () => {
    noteSignedOutHere();
    const first = render(<SignedOutHereNotice app="livediagram" />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
    first.unmount();

    noteSignedOutHere();
    render(<SignedOutHereNotice app="livediagram" />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('createSiteAccount', () => {
  const SiteAccount = createSiteAccount({
    app: 'livedocuments',
    load: async () => ({ default: () => <span>menu</span> }),
    useSignedInHint: () => false,
  });

  it('hangs the notice under a product header’s account control, where an editor’s Sign Out lands', () => {
    noteSignedOutHere();
    render(<SiteAccount />);
    expect(screen.getByRole('button', { name: 'Guest, account menu' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Signed out of livedocuments only');
  });

  it('draws the product’s menu for someone signed in, its notice beside it', async () => {
    const SignedIn = createSiteAccount({
      app: 'livedesign',
      load: async () => ({ default: () => <span>menu</span> }),
      useSignedInHint: () => true,
    });
    render(<SignedIn />);
    expect(await screen.findByText('menu')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
