// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The options flyout": on a phone the tool's options are a bottom sheet, closed
// as the desktop's card is, by a press outside it (or Escape), with the tool still in hand.
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { photoView } from './photo-view-test-utils';
import { PhotoPhoneOptionsSheet } from './PhotoPhoneOptions';

const sheet = () => document.querySelector('[data-bottom-sheet]');

beforeEach(() => {
  act(() => {
    photoTools.take('brush');
    toolFlyout.close();
  });
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  act(() => toolFlyout.close());
});

async function openSheet() {
  const { view } = photoView();
  render(<PhotoPhoneOptionsSheet photo={view} />);
  act(() => toolFlyout.open());
  await waitFor(() => expect(sheet()).toBeTruthy());
}

describe("a phone's tool options sheet", () => {
  it('stays open for a press inside it, and closes on one outside, the tool still in hand', async () => {
    await openSheet();
    fireEvent.pointerDown(sheet()!);
    expect(sheet()).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(sheet()).toBeNull());
    expect(photoTools.get().tool).toBe('brush');
  });

  it('closes on Escape', async () => {
    await openSheet();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(sheet()).toBeNull());
    expect(photoTools.get().tool).toBe('brush');
  });
});
