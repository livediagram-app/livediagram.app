// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, resetWorkbenchForTests, WORKBENCH_DEFAULTS } from '../../bindings';
import { indexClient } from '../../lib/index-client';
import {
  DEFERRED_AUTH_DEFAULT,
  DeferredAuthContext,
  type DeferredAuthState,
} from '../providers/deferred-auth';
import { useEditorInbox } from './useEditorInbox';

// The editor's door to Inbox notices (liveworkspace/docs/specs/004-index/inbox-notices.md "Who sees them, and
// where"): the signed-in account's own Inbox through this site's index client, nothing for a guest, and the
// notices' telemetry reported as UI·<event>·InboxNotice. The notices themselves are @liveworkspace/explorer's tests.

const seen = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>> }));
vi.mock('@liveworkspace/explorer/inbox-notices', async (real) => ({
  ...(await real<typeof import('@liveworkspace/explorer/inbox-notices')>()),
  useInboxNotices: (options: Record<string, unknown>) => {
    seen.options.push(options);
    return { count: options.viewerId ? 3 : undefined, notices: <div data-testid="notices" /> };
  },
}));

afterEach(() => {
  resetWorkbenchForTests();
  seen.options.length = 0;
});

function Door({ enabled }: { enabled?: boolean }) {
  const inbox = useEditorInbox('livediagram', enabled === undefined ? undefined : { enabled });
  return (
    <>
      <button type="button" className="relative" aria-label={inbox.label('Explorer')}>
        {inbox.badge}
      </button>
      {inbox.notices}
    </>
  );
}

const renderAs = (auth: Partial<DeferredAuthState>, enabled?: boolean) =>
  render(
    <DeferredAuthContext.Provider value={{ ...DEFERRED_AUTH_DEFAULT, authLoaded: true, ...auth }}>
      <Door enabled={enabled} />
    </DeferredAuthContext.Provider>,
  );

describe('useEditorInbox', () => {
  it('reads the signed-in account’s own Inbox, and names the count on the button', () => {
    const track = vi.fn();
    configureWorkbench({ ...WORKBENCH_DEFAULTS, track });
    renderAs({ isSignedIn: true, userId: 'user_1' });
    const options = seen.options.at(-1)!;
    expect(options).toMatchObject({
      client: indexClient,
      app: 'livediagram',
      viewerId: 'user_1',
      enabled: true,
    });
    expect(screen.getByRole('button', { name: 'Explorer, 3 in Inbox' })).toBeTruthy();
    expect(document.querySelector('[data-inbox-count]')!.textContent).toBe('3');
    expect(screen.getByTestId('notices')).toBeTruthy();
    (options.onTelemetry as (e: string) => void)('Opened');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'InboxNotice');
  });

  it('is nobody’s for a guest, and off when the editor says so', () => {
    renderAs({ isSignedIn: false, userId: 'guest_1' }, false);
    expect(seen.options.at(-1)).toMatchObject({ viewerId: null, enabled: false });
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeTruthy();
    expect(document.querySelector('[data-inbox-count]')).toBeNull();
  });
});
