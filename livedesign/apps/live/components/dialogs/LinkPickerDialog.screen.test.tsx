// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ElementLink } from '@livedesign/design';
import { initialLinkPickerMode, LinkPickerDialog } from './LinkPickerDialog';
import { screenLinkWith } from './ScreenLinkMode';

// docs/specs/007-editor/wireframe-pages.md "Setting a link": Link Element's Screen mode on a wireframe tab.
const screens = [
  { id: 'page-1', name: 'Home', here: true },
  { id: 'page-2', name: 'Checkout', here: false },
];

function open(props: Partial<Parameters<typeof LinkPickerDialog>[0]> = {}) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  render(
    <LinkPickerDialog
      title="Link element"
      currentLink={null}
      tabs={[{ id: 't', name: 'Flow' }]}
      currentTabId="t"
      recentDesigns={[]}
      screens={screens}
      onCommit={onCommit}
      onClose={onClose}
      {...props}
    />,
  );
  return { onCommit, onClose };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('LinkPickerDialog Screen mode', () => {
  it('comes first and opens on its screens, the element own screen shown but not pressable', () => {
    open();
    const modes = screen.getAllByRole('button', { pressed: true });
    expect(modes[0]!.textContent).toBe('Screen');
    expect(button(/Checkout/)).toBeTruthy();
    expect((button(/Home/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('this screen')).toBeTruthy();
  });

  it('links a screen with the chosen transition, and Back', () => {
    const { onCommit, onClose } = open();
    fireEvent.click(screen.getByRole('radio', { name: 'Slide' }));
    fireEvent.click(button(/Checkout/));
    expect(onCommit).toHaveBeenLastCalledWith({
      kind: 'page',
      pageId: 'page-2',
      transition: 'slide',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('stores no transition for Instant', () => {
    const { onCommit } = open();
    fireEvent.click(button(/Back/));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'back' });
  });

  it('seeds the transition from the element screen link and marks the linked row', () => {
    open({ currentLink: { kind: 'page', pageId: 'page-2', transition: 'dissolve' } });
    expect(screen.getByRole('radio', { name: 'Dissolve' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(button(/Checkout/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();
    expect(button('Remove link')).toBeTruthy();
  });

  it('marks a back link', () => {
    open({ currentLink: { kind: 'back' } });
    expect(button(/Back/).getAttribute('aria-pressed')).toBe('true');
  });

  it('says when the linked screen was deleted', () => {
    open({ currentLink: { kind: 'page', pageId: 'gone' } });
    expect(screen.getByRole('status').textContent).toContain("This link's screen was deleted");
  });

  it('shows the Screen mode alone for a Participant', () => {
    open({ screenOnly: true });
    expect(screen.queryByRole('button', { name: 'External URL' })).toBeNull();
    expect(screen.getByText(/Pick the screen pressing this element goes to/)).toBeTruthy();
  });

  it('offers no Screen mode without screens', () => {
    open({ screens: undefined });
    expect(screen.queryByRole('button', { name: 'Screen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'External URL' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});

describe('initialLinkPickerMode', () => {
  const at = (currentLink: ElementLink | null, extra: Record<string, unknown> = {}) =>
    initialLinkPickerMode({
      currentLink,
      urlOnly: false,
      hasScreens: true,
      screenOnly: false,
      ...extra,
    });

  it('opens on the current link kind, else Screen on a wireframe tab', () => {
    expect(at(null)).toBe('screen');
    expect(at({ kind: 'back' })).toBe('screen');
    expect(at({ kind: 'tab', tabId: 't' })).toBe('tab');
    expect(at({ kind: 'element', tabId: 't', elementId: 'e' })).toBe('tab');
    expect(at({ kind: 'design', designId: 'd', name: 'D' })).toBe('design');
    expect(at({ kind: 'url', url: 'https://x.test' })).toBe('url');
    expect(at(null, { hasScreens: false })).toBe('url');
  });

  it('takes the caller mode, but never a Screen mode it cannot show', () => {
    expect(at(null, { initialMode: 'design' })).toBe('design');
    expect(at({ kind: 'url', url: 'https://x.test' }, { initialMode: 'screen' })).toBe('screen');
    expect(at(null, { initialMode: 'screen', hasScreens: false })).toBe('url');
    expect(at(null, { urlOnly: true })).toBe('url');
    expect(at({ kind: 'tab', tabId: 't' }, { screenOnly: true })).toBe('screen');
  });
});

describe('screenLinkWith', () => {
  it('omits Instant and keeps the others', () => {
    expect(screenLinkWith({ kind: 'back' }, 'instant')).toEqual({ kind: 'back' });
    expect(screenLinkWith({ kind: 'page', pageId: 'p' }, 'dissolve')).toEqual({
      kind: 'page',
      pageId: 'p',
      transition: 'dissolve',
    });
  });
});
