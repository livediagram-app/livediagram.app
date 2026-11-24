// @vitest-environment jsdom
// A phone's top row (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md): the logo and Apps in the menu card
// in place of the hamburger, the corner card gone with its actions in the Apps drawer, per role, and the desktop as it
// was.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWorkbenchForTests } from '../../../bindings';
import {
  DEFERRED_AUTH_DEFAULT,
  DeferredAuthContext,
  type DeferredAuthState,
} from '../../providers/deferred-auth';
import type { EditorInbox } from '../useEditorInbox';
import { EditorCornerActions } from '../EditorCornerActions';
import { ExplorerMenuButtons } from './ExplorerMenuButtons';
import { publishPhoneApps } from './phone-apps-store';
import { resetPhoneAppsSectionForTests, usePhoneAppsSection } from './phone-apps-section';

vi.mock('../AuthControls', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../AuthControls')>()),
  AuthControls: () => <span>Account control</span>,
}));

// The call: none to offer unless a test sets one.
const callAction = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../item-call/useItemCallAction', () => ({
  useItemCallAction: () => callAction.current,
}));
vi.mock('../../item-call/item-call-store', () => ({
  useItemCalls: () => ({ source: null, read: null }),
}));

function phone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  callAction.current = null;
});
afterEach(() => {
  act(() => publishPhoneApps(null));
  act(() => resetPhoneAppsSectionForTests());
  vi.unstubAllGlobals();
  resetWorkbenchForTests();
  document.documentElement.style.removeProperty('--corner-card-room');
});

const signedIn: Partial<DeferredAuthState> = {
  isSignedIn: true,
  userId: 'user_1',
  user: { firstName: 'Ada', fullName: 'Ada Lovelace' } as DeferredAuthState['user'],
};

function withAuth(auth: Partial<DeferredAuthState>, children: ReactNode) {
  return (
    <DeferredAuthContext.Provider value={{ ...DEFERRED_AUTH_DEFAULT, authLoaded: true, ...auth }}>
      {children}
    </DeferredAuthContext.Provider>
  );
}

const inbox = (count: number | undefined): EditorInbox => ({
  count,
  label: (name) => (count ? `${name}, ${count} in Inbox` : name),
  badge: count ? <span data-testid="hamburger-badge">{count}</span> : null,
  notices: null,
});

type Corner = Partial<Parameters<typeof EditorCornerActions>[0]>;

// The editor: the menu card's buttons and the corner card, as each app wires them.
function editor({
  auth = signedIn,
  corner = {},
  count = 3,
  onToggle = () => {},
  hasInbox = true,
}: {
  auth?: Partial<DeferredAuthState>;
  corner?: Corner;
  count?: number | undefined;
  onToggle?: (button: HTMLElement) => void;
  hasInbox?: boolean;
} = {}) {
  return render(
    withAuth(
      auth,
      <>
        <ExplorerMenuButtons
          app="livediagram"
          open={false}
          onToggle={onToggle}
          itemId="d1"
          inbox={hasInbox ? inbox(count) : undefined}
        />
        <EditorCornerActions
          showShare
          shareable
          visibility={{ team: true }}
          onOpenShare={() => {}}
          copyDescription="Copy it."
          itemName="Offsite Planning"
          call={<span>Call slot</span>}
          {...corner}
        />
      </>,
    ),
  );
}

// The drawer's code loads on the first press (lazy), so each open waits for it.
const openApps = async () => {
  fireEvent.click(screen.getByRole('button', { name: /^Apps/ }));
  await screen.findByRole('dialog', { name: 'Offsite Planning' });
};
const drawer = () => screen.getByRole('dialog', { name: 'Offsite Planning' });
const tileNames = () =>
  [...drawer().querySelectorAll('[data-apps-tile]')].map((el) => el.getAttribute('data-apps-tile'));

describe('on a desktop', () => {
  it('keeps the hamburger and the corner card, and publishes nothing', () => {
    phone(false);
    const onToggle = vi.fn();
    const { container } = editor({ onToggle });
    const menu = screen.getByRole('button', { name: 'Explorer, 3 in Inbox' });
    expect(screen.getByTestId('hamburger-badge')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Apps/ })).toBeNull();
    expect(container.querySelector('[data-phone-logo]')).toBeNull();
    expect(container.querySelector('[data-corner-actions]')).not.toBeNull();
    expect(screen.getByText('Account control')).toBeTruthy();
    fireEvent.click(menu);
    expect(onToggle).toHaveBeenCalledWith(menu);
  });
});

describe('on a phone', () => {
  beforeEach(() => phone(true));

  it('puts the logo (opening the Explorer panel) and Apps in the menu card, and draws no corner card', () => {
    document.documentElement.style.setProperty('--corner-card-room', '120px');
    const onToggle = vi.fn();
    const { container } = editor({ onToggle });
    const logo = screen.getByRole('button', { name: 'Explorer' });
    expect(logo.hasAttribute('data-phone-logo')).toBe(true);
    expect(logo.querySelector('svg')).not.toBeNull();
    fireEvent.click(logo);
    expect(onToggle).toHaveBeenCalledWith(logo);
    expect(screen.queryByTestId('hamburger-badge')).toBeNull();
    expect(container.querySelector('[data-corner-actions]')).toBeNull();
    expect(screen.queryByText('Account control')).toBeNull();
  });

  it('wears a dot and names the count while the Inbox has unread items', () => {
    const { unmount } = editor({ count: 3 });
    const apps = screen.getByRole('button', { name: 'Apps, 3 in Inbox' });
    expect(apps.querySelector('[data-unread-dot]')).not.toBeNull();
    unmount();
    editor({ count: 0 });
    expect(
      screen.getByRole('button', { name: 'Apps' }).querySelector('[data-unread-dot]'),
    ).toBeNull();
  });

  it('opens the drawer with the item, who can see it, and an Editor’s tiles', async () => {
    callAction.current = { kind: 'start', starting: false, source: {}, run: vi.fn() };
    editor({
      corner: { present: { slideCount: 2, starting: false, onPresent: () => {} } },
    });
    await openApps();
    expect(within(drawer()).getByText('livediagram · Shared and Team')).toBeTruthy();
    expect(tileNames()).toEqual(['explorer', 'call', 'share', 'present', 'copy-link', 'inbox']);
    expect(within(drawer()).getByRole('link', { name: 'Inbox, 3 unread' })).toBeTruthy();
    expect(within(drawer()).getByText('3')).toBeTruthy();
  });

  it('leads with the app’s own section while one is published, and drops it when it goes', async () => {
    function Section({ on }: { on: boolean }) {
      usePhoneAppsSection(<p>Editor mode picker</p>, on);
      return null;
    }
    const view = editor();
    const host = render(<Section on />);
    await openApps();
    const section = drawer().querySelector('[data-phone-apps-section]');
    expect(section?.textContent).toBe('Editor mode picker');
    host.rerender(<Section on={false} />);
    expect(drawer().querySelector('[data-phone-apps-section]')).toBeNull();
    host.unmount();
    view.unmount();
  });

  it('sends Explorer straight to the Explorer page, no panel', async () => {
    const onToggle = vi.fn();
    editor({ onToggle });
    await openApps();
    const explorer = within(drawer()).getByRole('link', { name: 'Explorer' });
    expect(explorer.getAttribute('href')).toBe('/explorer?item=d1');
    fireEvent.click(explorer);
    expect(onToggle).not.toHaveBeenCalled();
    const inboxLink = within(drawer()).getByRole('link', { name: /^Inbox/ });
    expect(inboxLink.getAttribute('href')).toBe('/explorer/inbox');
  });

  it('closes, then opens Share', async () => {
    const onOpenShare = vi.fn();
    editor({ corner: { onOpenShare } });
    await openApps();
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Share' }));
    expect(onOpenShare).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('copies the page’s address with Copy Link', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    editor();
    await openApps();
    await act(async () => {
      fireEvent.click(within(drawer()).getByRole('button', { name: 'Copy Link' }));
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('says so when the browser refuses the copy', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    editor();
    await openApps();
    await act(async () => {
      fireEvent.click(within(drawer()).getByRole('button', { name: 'Copy Link' }));
    });
    expect(writeText).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('gives a visitor Make a Copy instead of Share, and joins a live call', async () => {
    const onMakeCopy = vi.fn();
    const run = vi.fn();
    callAction.current = { kind: 'join', source: {}, live: { people: 3 }, run };
    editor({ corner: { showShare: false, onMakeCopy } });
    await openApps();
    expect(tileNames()).toEqual(['explorer', 'call', 'copy-link', 'make-copy', 'inbox']);
    fireEvent.click(within(drawer()).getByRole('button', { name: /Join Call/ }));
    expect(run).toHaveBeenCalledOnce();
    await openApps();
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Make a Copy' }));
    expect(onMakeCopy).toHaveBeenCalledOnce();
  });

  it('gives a guest Explorer, Copy Link and Sign In, no Inbox', async () => {
    editor({ auth: { isSignedIn: false }, corner: { showShare: false } });
    await openApps();
    expect(tileNames()).toEqual(['explorer', 'copy-link']);
    expect(within(drawer()).getByRole('link', { name: /Sign In/ })).toBeTruthy();
  });

  it('opens Account from the account row', async () => {
    const onOpenAccount = vi.fn();
    editor({ corner: { onOpenAccount } });
    await openApps();
    fireEvent.click(within(drawer()).getByRole('button', { name: /Account/ }));
    expect(onOpenAccount).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the app’s own corner actions with their names, and none of Share where they stand in for it', async () => {
    editor({
      corner: {
        shareAction: (
          <button type="button">
            <span className="phone:sr-only">Share Form</span>
          </button>
        ),
      },
    });
    await openApps();
    expect(tileNames()).not.toContain('share');
    const slots = drawer().querySelector('[data-phone-apps-slots]');
    expect(slots && within(slots as HTMLElement).getByText('Share Form')).toBeTruthy();
  });

  it('has no Inbox tile in an app without one, and no dot', async () => {
    editor({ hasInbox: false });
    expect(
      screen.getByRole('button', { name: 'Apps' }).querySelector('[data-unread-dot]'),
    ).toBeNull();
    await openApps();
    expect(tileNames()).not.toContain('inbox');
  });

  it('closes on its Close button', async () => {
    editor();
    await openApps();
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
