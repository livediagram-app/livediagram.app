// @vitest-environment jsdom

// The account link page (docs/specs/030-knowledgebase/chat-apps.md "Linking an account"): opening it changes nothing,
// signed out it asks to sign in, signed in Connect links once, and a used or old link says so.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  DeferredAuthContext,
  DEFERRED_AUTH_DEFAULT,
} from '@liveworkspace/workbench/components/providers/deferred-auth';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import { ChatLinkView } from './ChatLinkView';

const PREVIEW = { platform: 'slack' as const, workspace: 'Acme', userName: 'ana' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

function open(signedIn: boolean, api = {}) {
  window.history.replaceState(null, '', '/chat/link?code=abc');
  const calls = {
    preview: vi.fn(async () => PREVIEW),
    complete: vi.fn(async () => ({ platform: 'slack' as const, workspace: 'Acme' })),
    ...api,
  };
  render(
    <DeferredAuthContext.Provider
      value={{
        ...DEFERRED_AUTH_DEFAULT,
        authLoaded: true,
        isSignedIn: signedIn,
        userId: signedIn ? 'user_o' : null,
      }}
    >
      <ChatLinkView api={calls} />
    </DeferredAuthContext.Provider>,
  );
  return calls;
}

describe('the account link page', () => {
  it('shows what it connects and links on Connect, once', async () => {
    const api = open(true);
    expect(
      await screen.findByRole('heading', { name: 'Connect Slack to liveknowledge' }),
    ).toBeTruthy();
    expect(screen.getByText(/ana in Acme will get answers/)).toBeTruthy();
    expect(api.complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Connect My Account' }));
    expect(await screen.findByRole('heading', { name: 'Your Account Is Connected' })).toBeTruthy();
    expect(api.complete).toHaveBeenCalledWith('user_o', 'abc');
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'ChatAccountLinked');
  });

  it('asks a signed-out visitor to sign in', async () => {
    open(false);
    expect(await screen.findByRole('link', { name: 'Sign In to Connect' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect My Account' })).toBeNull();
  });

  it('says a used or old link has expired', async () => {
    open(true, {
      preview: vi.fn(async () => {
        throw new ApiError('read chat link', 410, 'link_expired');
      }),
    });
    expect(await screen.findByRole('heading', { name: 'This Link Has Expired' })).toBeTruthy();
  });

  it('says so when the link is taken between opening and Connect', async () => {
    open(true, {
      complete: vi.fn(async () => {
        throw new ApiError('link chat account', 410, 'link_expired');
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Connect My Account' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'This Link Has Expired' })).toBeTruthy(),
    );
  });
});
