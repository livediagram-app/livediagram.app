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
      diagramName="Untitled diagram"
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

describe('EditorHeader rename requests', () => {
  const header = (renameNonce: number, hideTitle = false) => (
    <EditorHeader
      diagramName="Untitled diagram"
      showShare={false}
      shareable={false}
      onOpenShare={() => {}}
      onRename={() => {}}
      renameNonce={renameNonce}
      hideTitle={hideTitle}
    />
  );
  const editing = () => screen.queryByDisplayValue('Untitled diagram');

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
    fireEvent.blur(screen.getByDisplayValue('Untitled diagram'));
    expect(editing()).toBeNull();
    rerender(header(1, true));
    rerender(header(1, false));
    expect(editing()).toBeNull();
  });
});
