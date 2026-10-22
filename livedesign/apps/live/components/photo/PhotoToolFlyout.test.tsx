// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The options flyout": pressing a tool's button opens its options as a card in
// the category flyout's look, in sections; the same button again, a press on the photo, Escape or putting the tool
// down closes it, and a key taking a tool never opens it.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fieldsFor } from '@/lib/photo-editor/tool-option-fields';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { beginCrop, cropBox } from '@/lib/photo-editor/tools/crop-tool';
import { photoView } from './photo-view-test-utils';
import { PhotoToolFlyout } from './PhotoToolFlyout';
import { sectionFields } from './PhotoToolOptionsBody';
import { pressTool } from './PhotoToolsRail';

// The pressed tool's button the card hangs from.
function rail() {
  const r = document.createElement('div');
  r.setAttribute('data-photo-rail', '');
  const b = document.createElement('button');
  b.setAttribute('aria-pressed', 'true');
  b.getBoundingClientRect = () => ({ left: 400, right: 436, bottom: 120 }) as DOMRect;
  r.append(b);
  document.body.append(r);
  return b;
}

beforeEach(() => {
  act(() => {
    photoTools.take(null);
    photoTools.resetOptions('brush');
    toolFlyout.close();
  });
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const card = () => document.querySelector('[data-photo-flyout]');

async function openBrush() {
  const button = rail();
  const { view } = photoView();
  render(<PhotoToolFlyout photo={view} />);
  // The first press takes the Brush, its options shut; the second, on the tool in hand, opens them.
  act(() => pressTool('brush'));
  await new Promise((r) => setTimeout(r, 30));
  expect(card()).toBeNull();
  act(() => pressTool('brush'));
  await waitFor(() => expect(card()).toBeTruthy());
  return button;
}

describe('the options flyout', () => {
  it("opens from the button of the tool in hand with the tool's name, line and sections", async () => {
    await openBrush();
    const flyout = within(card() as HTMLElement);
    expect(flyout.getByRole('heading', { name: 'Brush' })).toBeTruthy();
    expect(flyout.getByText('Paint soft strokes in the foreground colour.')).toBeTruthy();
    for (const s of ['Tip', 'Paint', 'Pen', 'Presets'])
      expect(flyout.getByRole('region', { name: s })).toBeTruthy();
  });

  it("offers the group's other tools at the top, and switches without closing", async () => {
    await openBrush();
    const tools = screen.getByRole('radiogroup', { name: 'Tool' });
    expect(within(tools).getByRole('radio', { name: 'Brush' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(within(tools).getByRole('radio', { name: 'Pencil' }));
    expect(photoTools.get().tool).toBe('pencil');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pencil' })).toBeTruthy());
  });

  it('changes an option in place', async () => {
    await openBrush();
    fireEvent.change(screen.getByRole('slider', { name: 'Opacity' }), { target: { value: '0.4' } });
    expect(photoTools.get().options.brush.opacity).toBe(0.4);
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(photoTools.get().options.brush.pressure).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(photoTools.get().options.brush.opacity).toBe(1);
  });

  it('closes on a press on the photo, but not on one inside it or on the tools', async () => {
    const button = await openBrush();
    fireEvent.pointerDown(screen.getByRole('slider', { name: 'Size' }));
    fireEvent.pointerDown(button);
    expect(card()).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(card()).toBeNull());
    expect(photoTools.get().tool).toBe('brush');
  });

  it('closes on Escape with the tool still in hand', async () => {
    await openBrush();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(card()).toBeNull());
    expect(photoTools.get().tool).toBe('brush');
  });

  it("toggles on the tool's own button, and goes with the tool", async () => {
    await openBrush();
    act(() => pressTool('brush'));
    await waitFor(() => expect(card()).toBeNull());
    act(() => pressTool('brush'));
    await waitFor(() => expect(card()).toBeTruthy());
    act(() => photoTools.take(null));
    await waitFor(() => expect(card()).toBeNull());
    expect(toolFlyout.isOpen()).toBe(false);
  });

  it('closes when another tool is pressed, and stays shut for it', async () => {
    await openBrush();
    act(() => pressTool('lasso'));
    await waitFor(() => expect(card()).toBeNull());
    expect(photoTools.get().tool).toBe('lasso');
    await new Promise((r) => setTimeout(r, 30));
    expect(card()).toBeNull();
  });

  it('is not opened by a key taking a tool', async () => {
    rail();
    const { view } = photoView();
    render(<PhotoToolFlyout photo={view} />);
    act(() => photoTools.take('lasso'));
    await new Promise((r) => setTimeout(r, 30));
    expect(card()).toBeNull();
  });
});

describe('while a crop box is open', () => {
  it('shows a small bar with Options, Cancel and Crop, and Options opens the card', async () => {
    rail();
    const { view } = photoView();
    render(<PhotoToolFlyout photo={view} />);
    act(() => {
      photoTools.take('crop');
      beginCrop(view.ctx!);
    });
    const bar = await screen.findByRole('toolbar', { name: 'Crop' });
    expect(within(bar).getByRole('button', { name: 'Crop' })).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: 'Options' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Crop Options' })).toBeTruthy());
    // A press outside folds it back to the bar, the box still open.
    fireEvent.pointerDown(document.body);
    const again = await screen.findByRole('toolbar', { name: 'Crop' });
    fireEvent.click(within(again).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(cropBox.get()).toBeNull());
    expect(card()).toBeNull();
  });
});

describe("a tool's sections", () => {
  it('files each option under its section, toggles last', () => {
    const titles = sectionFields(fieldsFor('clone', 'clone')).map((s) => s.title);
    expect(titles).toEqual(['Tip', 'Paint', 'Behaviour']);
    const gradient = sectionFields(fieldsFor('gradient', 'gradient'));
    expect(gradient[0]!.title).toBe('Gradient');
    expect(gradient[0]!.fields[0]!.guide).toBe('gradientStyle');
  });
  it("puts all the Text tool's options under Type", () => {
    expect(sectionFields(fieldsFor('text', 'text'), 'text').map((s) => s.title)).toEqual(['Type']);
  });
});
