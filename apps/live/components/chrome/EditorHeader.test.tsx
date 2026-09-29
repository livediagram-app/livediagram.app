// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Header stack row (docs/specs/004-interface-design/optical-alignment.md, "A stack row shares one line"):
// every header action holds its glyph in the same 20px icon slot, so an avatar beside a 13px icon no
// longer drops its label below its neighbour's.

vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true }));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    authLoaded: true,
    isSignedIn: true,
    user: { firstName: 'Webber', fullName: 'Webber Takken', email: 'w@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { EditorHeader } = await import('./EditorHeader');
const { HEADER_ICON_SLOT_PX } = await import('./header-action');

afterEach(cleanup);

function renderHeader() {
  return render(
    <EditorHeader
      documentName="Untitled document"
      showShare
      shareable={false}
      onMakeCopy={() => {}}
      onOpenShare={() => {}}
      onRename={() => {}}
    />,
  );
}

describe('EditorHeader stack row', () => {
  it('uses a 20px slot', () => {
    expect(HEADER_ICON_SLOT_PX).toBe(20);
  });

  it.each([['Copy'], ['Share'], ['Account menu']])(
    '%s holds its glyph in the shared slot',
    (name) => {
      renderHeader();
      const action = screen.getByRole('button', { name: new RegExp(name) });
      const slot = action.firstElementChild as HTMLElement;
      expect(slot.dataset.optical).toBe('slot');
      expect(slot.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
      expect(slot.style.height).toBe(`${HEADER_ICON_SLOT_PX}px`);
    },
  );

  it('draws the account initial as a glyph disc filling the slot', () => {
    renderHeader();
    const slot = screen.getByRole('button', { name: 'Account menu' })
      .firstElementChild as HTMLElement;
    const disc = slot.firstElementChild as HTMLElement;
    expect(disc.dataset.optical).toBe('disc');
    expect(disc.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    expect(disc.querySelector('.text-optical-centre')?.textContent).toBe('W');
  });
});

// The account menu's Account item opens Settings in place
// (docs/specs/007-editor/user-preferences.md) instead of navigating to the Explorer.
describe('EditorHeader account menu', () => {
  it('opens Settings on Account in place when the host can', () => {
    const onOpenAccount = vi.fn();
    render(
      <EditorHeader
        documentName="d"
        showShare={false}
        shareable={false}
        onOpenShare={() => {}}
        onOpenAccount={onOpenAccount}
        onRename={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const item = screen.getByRole('menuitem', { name: 'Account' });
    expect(item.tagName).toBe('BUTTON');
    fireEvent.click(item);
    expect(onOpenAccount).toHaveBeenCalledOnce();
    // The account menu closes (the section switch keeps its own menu mounted).
    expect(screen.queryByRole('menuitem', { name: 'Account' })).toBeNull();
  });

  it('falls back to the Explorer deep link without a handler', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Account' }).getAttribute('href')).toBe(
      '/explorer?settings=account',
    );
  });
});

describe('EditorHeader rename requests', () => {
  const header = (renameNonce: number, hideTitle = false) => (
    <EditorHeader
      documentName="Untitled document"
      showShare={false}
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
      renameNonce={renameNonce}
      hideTitle={hideTitle}
    />
  );
  const editing = () => screen.queryByDisplayValue('Untitled document');

  it('opens the name editor for a request, never on mount', () => {
    const { rerender } = render(header(0));
    expect(editing()).toBeNull();
    rerender(header(1));
    expect(editing()).not.toBeNull();
  });

  it('honours a request made while the title is hidden once it shows, and only once', () => {
    const { rerender } = render(header(0, true));
    rerender(header(1, true));
    expect(editing()).toBeNull();
    rerender(header(1, false));
    expect(editing()).not.toBeNull();
    fireEvent.blur(screen.getByDisplayValue('Untitled document'));
    expect(editing()).toBeNull();
    rerender(header(1, true));
    rerender(header(1, false));
    expect(editing()).toBeNull();
  });
});
