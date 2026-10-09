// @vitest-environment jsdom

// The Background section (docs/specs/007-editor/illustrate-pages.md "Backgrounds").
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IllustratePage, PageFill } from '@livediagram/document';
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

function show(fill?: PageFill, presets: ThemeBackgroundPreset[] = theme) {
  const page = { id: 'p', orientation: 'portrait', ...(fill ? { background: { fill } } : {}) };
  const onBackground = vi.fn();
  render(
    <BackgroundSection
      page={page as IllustratePage}
      themePresets={presets}
      onBackground={onBackground}
      onPreview={vi.fn()}
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
    expect(screen.getByRole('radiogroup', { name: 'Background colour' })).toBeTruthy();
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
});
