// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The options flyout": on a phone the tool's options are a bottom sheet, closed
// as the desktop's card is, by a press outside it (or Escape), with the tool still in hand.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { beginCrop, cancelCrop, cropBox } from '@/lib/photo-editor/tools/crop-tool';
import { beginTransform } from '@/lib/photo-editor/tools/transform-tool';
import { solid } from '@/lib/photo-editor/photo-test-utils';
import { photoView } from './photo-view-test-utils';
import { PhotoPhoneHeldBar, PhotoPhoneOptionsSheet } from './PhotoPhoneOptions';

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

// Work Tracker 1282: Crop closes the sheet so the cropped photo shows at once, and Show Crop Box is one tap away.
describe('cropping on a phone', () => {
  async function cropping() {
    const h = photoView();
    act(() => {
      photoTools.take('crop');
      beginCrop(h.view.ctx!);
    });
    return h;
  }
  afterEach(() => act(() => cancelCrop(photoView().view.ctx!)));

  it("closes the sheet when the sheet's Crop crops, and the sheet opens again on Show Crop Box", async () => {
    const { view } = await cropping();
    render(<PhotoPhoneOptionsSheet photo={view} />);
    act(() => toolFlyout.open());
    await waitFor(() => expect(sheet()).toBeTruthy());
    fireEvent.click(within(sheet() as HTMLElement).getByRole('button', { name: 'Crop' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(cropBox.get()).toBeNull();
    // The tool is still in hand: a tap on it opens the sheet, offering Show Crop Box.
    expect(photoTools.get().tool).toBe('crop');
    act(() => toolFlyout.open());
    await waitFor(() => expect(sheet()).toBeTruthy());
    expect(
      within(sheet() as HTMLElement).getByRole('button', { name: 'Show Crop Box' }),
    ).toBeTruthy();
  });

  it("closes the sheet when the bar's Crop crops", async () => {
    const { view } = await cropping();
    render(
      <>
        <PhotoPhoneHeldBar photo={view} />
        <PhotoPhoneOptionsSheet photo={view} />
      </>,
    );
    act(() => toolFlyout.open());
    await waitFor(() => expect(sheet()).toBeTruthy());
    const bar = screen.getByRole('toolbar', { name: 'Crop' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Crop' }));
    await waitFor(() => expect(sheet()).toBeNull());
    expect(cropBox.get()).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Crop' })).toBeNull();
  });

  it('commits a Free Transform from the bar, the sheet left as it was', async () => {
    const { view } = photoView(undefined, { a: solid(16, 12, [200, 40, 40, 255]) });
    act(() => {
      view.session!.active = 'a';
      expect(beginTransform(view.ctx!)).toBe(true);
    });
    render(<PhotoPhoneHeldBar photo={view} />);
    act(() => toolFlyout.open());
    const bar = screen.getByRole('toolbar', { name: 'Free Transform' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Commit' }));
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    expect(toolFlyout.isOpen()).toBe(true);
  });
});
