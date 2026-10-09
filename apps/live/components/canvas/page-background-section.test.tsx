// @vitest-environment jsdom

// The Background section (docs/specs/007-editor/illustrate-pages.md "Backgrounds").
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  penColourHex,
  standardColours,
  type IllustratePage,
  type PageFill,
} from '@livediagram/document';
import {
  backgroundCategoryOf,
  customGradientSeed,
  isCustomGradient,
  type ThemeBackgroundPreset,
} from '@/lib/illustrate-page-paint';
import { BackgroundSection } from './page-background-section';

afterEach(() => cleanup());

const theme: ThemeBackgroundPreset[] = [
  { id: 'theme-wash', label: 'Theme wash', fill: { kind: 'solid', color: '#eef2ff' } },
];
const custom: PageFill = { kind: 'gradient', from: '#123456', to: '#abcdef', angle: 90 };

let onPreview = vi.fn();
function show(fill?: PageFill, presets: ThemeBackgroundPreset[] = theme) {
  const page = { id: 'p', orientation: 'portrait', ...(fill ? { background: { fill } } : {}) };
  const onBackground = vi.fn();
  onPreview = vi.fn();
  render(
    <BackgroundSection
      page={page as IllustratePage}
      themePresets={presets}
      onBackground={onBackground}
      onPreview={onPreview}
    />,
  );
  return onBackground;
}
const radio = (name: string) => screen.getByRole('radio', { name });

describe('background categories', () => {
  it('names a fill’s category: a theme preset, a gradient, else solid', () => {
    expect(backgroundCategoryOf(undefined, theme)).toBe('solid');
    expect(backgroundCategoryOf(theme[0]!.fill, theme)).toBe('theme');
    expect(backgroundCategoryOf(custom, theme)).toBe('gradient');
    expect(isCustomGradient(custom, theme)).toBe(true);
    expect(isCustomGradient(undefined, theme)).toBe(false);
  });

  it('starts a custom gradient from the page’s fill', () => {
    expect(customGradientSeed(custom)).toBe(custom);
    expect(customGradientSeed({ kind: 'solid', color: '#ff0000' })).toMatchObject({
      kind: 'gradient',
      from: '#ff0000',
    });
    expect(customGradientSeed(undefined)).toMatchObject({ kind: 'gradient', angle: 160 });
  });
});

describe('BackgroundSection', () => {
  it('opens on the current fill’s category, and switching changes nothing on the page', () => {
    const onBackground = show(custom);
    expect(radio('Gradient').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('Solid'));
    expect(onBackground).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Background colour' })).toBeTruthy();
  });

  it('offers Theme only while the theme has backgrounds', () => {
    show(undefined, []);
    expect(screen.queryByRole('radio', { name: 'Theme' })).toBeNull();
  });

  it('makes a custom gradient from the custom swatch, and edits it', () => {
    const onBackground = show({ kind: 'solid', color: '#e0f2fe' });
    fireEvent.click(radio('Gradient'));
    fireEvent.click(radio('Custom gradient'));
    expect(onBackground).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ kind: 'gradient', from: '#e0f2fe' }),
    });
    cleanup();
    const edit = show(custom);
    expect(document.querySelector('[data-custom-gradient]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Swap' }));
    expect(edit).toHaveBeenLastCalledWith({ fill: { ...custom, from: '#abcdef', to: '#123456' } });
  });

  it('shows no editor for a preset gradient', () => {
    show({ kind: 'gradient', from: '#fde68a', to: '#fca5a5', angle: 160 });
    expect(document.querySelector('[data-custom-gradient]')).toBeNull();
  });

  it('previews the angle while dragged and commits it once on release', () => {
    const onBackground = show(custom);
    const slider = screen.getByRole('slider', { name: 'Angle' });
    fireEvent.change(slider, { target: { value: '135' } });
    fireEvent.change(slider, { target: { value: '140' } });
    expect(onBackground).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(onBackground).toHaveBeenCalledWith({ fill: { ...custom, angle: 140 } });
  });

  it('opens the editor from a preset gradient when Custom gradient is pressed', () => {
    show({ kind: 'gradient', from: '#fde68a', to: '#fca5a5', angle: 160 });
    expect(document.querySelector('[data-custom-gradient]')).toBeNull();
    fireEvent.click(radio('Custom gradient'));
    expect(document.querySelector('[data-custom-gradient]')).not.toBeNull();
    // A preset chosen again closes it.
    fireEvent.click(radio('Sunrise'));
    expect(document.querySelector('[data-custom-gradient]')).toBeNull();
  });

  it('offers Paper, then the soft and strong standard colours, on the one colour picker', () => {
    const onBackground = show({ kind: 'solid', color: standardColours('soft', 'light')[7]!.hex });
    const light = within(screen.getByRole('group', { name: 'Light' })).getAllByRole('button');
    expect(light.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Paper',
      ...standardColours('soft', 'light').map((c) => c.label),
    ]);
    expect(within(screen.getByRole('group', { name: 'Dark' })).getAllByRole('button')).toHaveLength(
      10,
    );
    // The page's fill is picked; Paper clears it.
    expect(light[8]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(light[0]!);
    expect(onBackground).toHaveBeenLastCalledWith({ fill: undefined });
    fireEvent.pointerEnter(
      within(screen.getByRole('group', { name: 'Dark' })).getByRole('button', { name: 'Red' }),
      {
        pointerType: 'mouse',
      },
    );
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: { kind: 'solid', color: penColourHex('red', 'light') },
    });
  });

  it('shows an older solid colour as the custom colour in force', () => {
    show({ kind: 'solid', color: '#fbf7ef' });
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    expect(yours[0]!.getAttribute('aria-label')).toBe('#fbf7ef');
    expect(yours[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('picks a custom solid in the panel: previews each change, Use commits and closes', () => {
    const onBackground = show({ kind: 'solid', color: '#123456' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    const hex = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.change(hex, { target: { value: '#ff0000' } });
    expect(onPreview).toHaveBeenLastCalledWith({ fill: { kind: 'solid', color: '#ff0000' } });
    expect(onBackground).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(onBackground).toHaveBeenCalledWith({ fill: { kind: 'solid', color: '#ff0000' } });
    expect(screen.queryByRole('textbox', { name: 'Hex' })).toBeNull();
  });

  it('closes a gradient end’s picker on Escape, dropping the preview and changing nothing', () => {
    const onBackground = show(custom);
    fireEvent.click(screen.getByRole('button', { name: 'Gradient from colour' }));
    const popover = screen.getByRole('dialog', { name: 'Gradient from colour' });
    fireEvent.pointerEnter(
      within(within(popover).getByRole('group', { name: 'Light' })).getByRole('button', {
        name: 'Green',
      }),
      {
        pointerType: 'mouse',
      },
    );
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: { ...custom, from: standardColours('soft', 'light')[5]!.hex },
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(onBackground).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Gradient from colour' })).toBeNull();
  });

  it('uses a gradient end picked from its popover', () => {
    const onBackground = show(custom);
    fireEvent.click(screen.getByRole('button', { name: 'Gradient to colour' }));
    const dark = screen.getByRole('group', { name: 'Dark' });
    fireEvent.click(within(dark).getByRole('button', { name: 'Blue' }));
    expect(onBackground).toHaveBeenCalledWith({
      fill: { ...custom, to: penColourHex('blue', 'light') },
    });
    expect(screen.queryByRole('dialog', { name: 'Gradient to colour' })).toBeNull();
  });
});
