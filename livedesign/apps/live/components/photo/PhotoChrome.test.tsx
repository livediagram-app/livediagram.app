// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The Photo panel": on a phone the panel is a bottom sheet off the tools row's
// Layers button, closed as the options sheet is: a tap outside it, Escape, or the button again. A tap in a menu it
// opens, or Escape in a field in it, is not leaving it.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { photoView } from './photo-view-test-utils';
import { PhotoChrome } from './PhotoChrome';

vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => true,
}));

const sheet = () => document.querySelector('[data-photo-layers-sheet]');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function openSheet() {
  const { view } = photoView();
  render(<PhotoChrome photo={view} scale={1} />);
  const button = screen.getByRole('button', { name: 'Layers' });
  expect(button.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(button);
  await waitFor(() => expect(sheet()).toBeTruthy());
  expect(button.getAttribute('aria-expanded')).toBe('true');
  return button;
}

describe("a phone's Layers sheet", () => {
  it('stays open for a tap inside it, and closes on one outside', async () => {
    await openSheet();
    fireEvent.pointerDown(sheet()!);
    expect(sheet()).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(sheet()).toBeNull());
  });

  it('stays open for a tap in a menu it opened (portalled out of it)', async () => {
    await openSheet();
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    fireEvent.pointerDown(menu);
    expect(sheet()).toBeTruthy();
  });

  it('toggles from its Layers button', async () => {
    const button = await openSheet();
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    await waitFor(() => expect(sheet()).toBeNull());
  });

  it('closes on Escape, but not on Escape typed in a field in it', async () => {
    await openSheet();
    const field = document.createElement('input');
    sheet()!.append(field);
    act(() => field.focus());
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(sheet()).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(sheet()).toBeNull());
  });
});
