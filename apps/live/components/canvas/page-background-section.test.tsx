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
import { BackgroundSection, pageThemeColours } from './page-background-section';

afterEach(() => cleanup());

const theme: ThemeBackgroundPreset[] = [
  {
    id: 'theme-glow',
    label: 'Theme glow',
    fill: { kind: 'gradient', from: '#eef2ff', to: '#ddd6fe', angle: 160 },
  },
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
  it('names a fill’s category: any gradient, else solid', () => {
    expect(backgroundCategoryOf(undefined)).toBe('solid');
    expect(backgroundCategoryOf({ kind: 'solid', color: '#eef2ff' })).toBe('solid');
    expect(backgroundCategoryOf(theme[0]!.fill)).toBe('gradient');
    expect(backgroundCategoryOf(custom)).toBe('gradient');
    expect(isCustomGradient(custom, theme)).toBe(true);
    expect(isCustomGradient(theme[0]!.fill, theme)).toBe(false);
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

  it('offers Solid and Gradient, the theme’s gradients in their own row', () => {
    show();
    expect(screen.queryByRole('radio', { name: 'Theme' })).toBeNull();
    fireEvent.click(radio('Gradient'));
    const names = (group: string) =>
      within(screen.getByRole('radiogroup', { name: group }))
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label'));
    expect(names('Theme gradients')).toEqual(['Theme glow']);
    expect(names('Background gradient')).toHaveLength(14);
    expect(names('Background gradient').at(-1)).toBe('Custom gradient');
  });

  it('keeps the Solid theme row to one row of ten, never the theme white', () => {
    const row = (hexes: string[]) =>
      pageThemeColours(hexes.map((h) => ({ id: h, colour: h, label: h })));
    const ten = [
      '#111111',
      '#222222',
      '#ffffff',
      '#333333',
      '#444444',
      '#555555',
      '#666666',
      '#777777',
      '#888888',
      '#999999',
    ];
    expect(row(ten).map((o) => o.colour)).not.toContain('#ffffff');
    expect(row(ten)).toHaveLength(9);
    expect(row([...ten, '#aaaaaa', '#bbbbbb'])).toHaveLength(9);
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

describe('the Animated category', () => {
  const slide = (fill?: PageFill) => {
    const page = {
      id: 's',
      orientation: 'landscape',
      kind: 'slide',
      ...(fill ? { background: { fill } } : {}),
    };
    const onBackground = vi.fn();
    onPreview = vi.fn();
    render(
      <BackgroundSection
        page={page as IllustratePage}
        themePresets={theme}
        onBackground={onBackground}
        onPreview={onPreview}
      />,
    );
    return onBackground;
  };

  it('is offered on a slide page alone', () => {
    show();
    expect(screen.queryByRole('radio', { name: 'Animated' })).toBeNull();
    cleanup();
    slide();
    expect(radio('Animated')).toBeTruthy();
  });

  it('previews a motion on hover and sets it on a press, as a gradient with its motion', () => {
    const onBackground = slide();
    fireEvent.click(radio('Animated'));
    fireEvent.pointerEnter(radio('Starfield'));
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ kind: 'gradient', motion: 'starfield' }),
    });
    fireEvent.click(radio('Aurora'));
    expect(onBackground).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ kind: 'gradient', motion: 'aurora' }),
    });
  });

  it('opens on Animated for a slide that has one, the motion marked', () => {
    slide({ kind: 'gradient', from: '#0b1020', to: '#123456', angle: 160, motion: 'waves' });
    expect(radio('Animated').getAttribute('aria-checked')).toBe('true');
    expect(radio('Waves').getAttribute('aria-checked')).toBe('true');
  });
});

describe('the Animated speed', () => {
  it('previews while dragged and is set once, on letting go, keeping the motion', () => {
    const page = {
      id: 's',
      orientation: 'landscape',
      kind: 'slide',
      background: {
        fill: { kind: 'gradient', from: '#0b1020', to: '#123456', angle: 160, motion: 'waves' },
      },
    };
    const onBackground = vi.fn();
    onPreview = vi.fn();
    render(
      <BackgroundSection
        page={page as IllustratePage}
        themePresets={theme}
        onBackground={onBackground}
        onPreview={onPreview}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Animation speed' });
    fireEvent.change(slider, { target: { value: '2' } });
    expect(onPreview).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ motion: 'waves', speed: 2 }),
    });
    expect(onBackground).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onBackground).toHaveBeenCalledTimes(1);
    expect(onBackground).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ motion: 'waves', speed: 2 }),
    });
  });
});

describe('Animated custom colours', () => {
  const customFill = {
    kind: 'gradient',
    from: '#ff0066',
    to: '#330099',
    angle: 160,
    motion: 'waves',
    speed: 2,
  } as const;
  const slideWith = (fill: PageFill) => {
    const onBackground = vi.fn();
    onPreview = vi.fn();
    render(
      <BackgroundSection
        page={
          {
            id: 's',
            orientation: 'landscape',
            kind: 'slide',
            background: { fill },
          } as IllustratePage
        }
        themePresets={theme}
        onBackground={onBackground}
        onPreview={onPreview}
      />,
    );
    return onBackground;
  };

  it('marks Custom for colours that are not the theme’s, and keeps them through a motion change', () => {
    const onBackground = slideWith(customFill as PageFill);
    expect(radio('Custom colours').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('Aurora'));
    expect(onBackground).toHaveBeenLastCalledWith({
      fill: expect.objectContaining({ from: '#ff0066', to: '#330099', motion: 'aurora', speed: 2 }),
    });
  });
});
