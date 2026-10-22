// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { penColourHex, standardColours } from '@livediagram/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { getTheme, themePresetColors } from '@/lib/themes';
import { ColourPicker, type ColourPickerProps } from './ColourPicker';
import { noColour, stableColours, standardGroup } from './colour-options';
import { colourKeyTarget } from './useColourKeys';
import { COLOUR_PICKER_WIDTH } from './colour-metrics';

const yourLabels = () =>
  within(screen.getByRole('group', { name: 'Custom Colours' }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label'));

// docs/specs/004-interface-design/colour-picker.md
function setup(props: Partial<ColourPickerProps> = {}) {
  const onPick = vi.fn();
  render(
    <ColourPicker
      label="Text colour"
      value={null}
      onPick={onPick}
      standard={[standardGroup('strong', 'light', 'name')]}
      {...props}
    />,
  );
  return { onPick, root: screen.getByRole('group', { name: 'Text colour' }) };
}
const keys = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-colour-key]'));

describe('ColourPicker', () => {
  it('is 276px wide and shows the ten standard colours, then Custom colours with +', () => {
    const { root } = setup();
    expect(COLOUR_PICKER_WIDTH).toBe(276);
    expect(root.style.width).toBe('276px');
    const colours = within(screen.getByRole('group', { name: 'Standard Colours' })).getAllByRole(
      'button',
    );
    expect(colours.map((b) => b.getAttribute('aria-label'))).toEqual(
      standardColours('strong', 'light').map((c) => c.label),
    );
    const yours = screen.getByRole('group', { name: 'Custom Colours' });
    const add = within(yours).getByRole('button', { name: 'Add a custom colour' });
    // More colours' four dots, never a +.
    expect(add.querySelectorAll('.rounded-full')).toHaveLength(4);
    expect(add.querySelector('svg')).toBeNull();
  });

  it('puts the Theme Palette first and leading options at its start', () => {
    setup({
      theme: [{ id: '#123456', colour: '#123456', label: 'Navy' }],
      leading: [noColour('transparent', 'No fill')],
    });
    const theme = within(screen.getByRole('group', { name: 'Theme Palette' })).getAllByRole(
      'button',
    );
    expect(theme.map((b) => b.getAttribute('aria-label'))).toEqual(['No fill', 'Navy']);
  });

  it('picks by id, and marks a hex value in any case', () => {
    const { onPick } = setup({
      standard: [standardGroup('strong', 'light', 'hex')],
      value: penColourHex('red', 'light').toUpperCase(),
    });
    expect(screen.getByRole('button', { name: 'Red' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(onPick).toHaveBeenCalledWith(penColourHex('blue', 'light'));
  });

  it('shows a custom colour in force first in Custom colours, picked, and caps the list', () => {
    const yours = Array.from({ length: 14 }, (_, i) => `#0000${(i + 16).toString(16)}`);
    setup({ value: '#ABCDEF', yours });
    const swatches = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    // Twelve colours and +.
    expect(swatches).toHaveLength(13);
    expect(swatches[0]!.getAttribute('aria-label')).toBe('#abcdef');
    expect(swatches[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('has one Tab stop: the picked swatch, else the first', () => {
    const first = setup({ value: 'teal' });
    expect(
      keys(first.root)
        .filter((k) => k.tabIndex === 0)
        .map((k) => k.getAttribute('aria-label')),
    ).toEqual(['Teal']);
  });

  it('starts on the first swatch when nothing is picked', () => {
    const { root } = setup();
    expect(
      keys(root)
        .filter((k) => k.tabIndex === 0)[0]!
        .getAttribute('aria-label'),
    ).toBe('Ink');
  });

  it('moves focus with the arrows, wrapping, without picking', () => {
    const { root, onPick } = setup();
    const all = keys(root);
    all[0]!.focus();
    fireEvent.keyDown(all[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(all[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(all[1]!, { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('colourKeyTarget wraps and ignores other keys', () => {
    expect(colourKeyTarget('ArrowRight', 2, 3)).toBe(0);
    expect(colourKeyTarget('ArrowUp', 0, 3)).toBe(2);
    expect(colourKeyTarget('a', 0, 3)).toBe(-1);
    expect(colourKeyTarget('ArrowRight', -1, 3)).toBe(-1);
    expect(colourKeyTarget('End', 0, 0)).toBe(-1);
  });

  it('+ opens the custom colour editor; Use picks the colour lower-cased and closes it', () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    const hex = screen.getByRole('textbox', { name: 'Hex' });
    fireEvent.change(hex, { target: { value: '#A1B2C3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(onPick).toHaveBeenCalledWith('#a1b2c3');
    expect(screen.queryByRole('textbox', { name: 'Hex' })).toBeNull();
  });

  it('previews on focus and on mouse hover, and reverts on leaving and unmounting', () => {
    const onPreview = vi.fn();
    const onPreviewEnd = vi.fn();
    const onPick = vi.fn();
    const view = render(
      <div>
        <ColourPicker
          label="Fill"
          value={null}
          onPick={onPick}
          standard={[standardGroup('soft', 'light', 'hex')]}
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
        />
        <button type="button">outside</button>
      </div>,
    );
    const green = screen.getByRole('button', { name: 'Green' });
    fireEvent.pointerEnter(green, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith(standardColours('soft', 'light')[5]!.hex);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Blue' }), { pointerType: 'touch' });
    expect(onPreview).toHaveBeenCalledTimes(1);
    fireEvent.focus(screen.getByRole('button', { name: 'Teal' }));
    expect(onPreview).toHaveBeenCalledTimes(2);
    fireEvent.blur(screen.getByRole('button', { name: 'Teal' }), {
      relatedTarget: screen.getByRole('button', { name: 'outside' }),
    });
    expect(onPreviewEnd).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(onPreviewEnd).toHaveBeenCalledTimes(2);
  });
  it('keeps Custom colours in place while a hover preview reorders the document', () => {
    const props = { label: 'Fill', onPick: vi.fn(), standard: [] };
    const { rerender } = render(
      <ColourPicker {...props} value="#111111" yours={['#222222', '#333333']} />,
    );
    const before = yourLabels();
    expect(before).toEqual(['#111111', '#222222', '#333333', 'Add a custom colour']);
    // Hovering #333333 previews it: it is now in force and newest, and #111111 is painted over.
    rerender(<ColourPicker {...props} value="#333333" yours={['#333333', '#222222']} />);
    expect(yourLabels()).toEqual(before);
    // A genuinely new colour (a custom pick) joins at the front.
    rerender(<ColourPicker {...props} value="#444444" yours={['#444444', '#222222']} />);
    expect(yourLabels()[0]).toBe('#444444');
    expect(yourLabels().slice(1)).toEqual(before);
  });
});

describe('the Theme Palette', () => {
  const inEditor = (props: Partial<ColourPickerProps>) =>
    render(
      <EditorContext.Provider value={{ tabs: [], activeTab: { theme: 'ocean' } } as never}>
        <ColourPicker label="Colour" value={null} onPick={vi.fn()} {...props} />
      </EditorContext.Provider>,
    );

  it('shows the active tab’s theme colours first in the editor, whatever the surface', () => {
    inEditor({ standard: [standardGroup('strong', 'light', 'hex')] });
    const theme = within(screen.getByRole('group', { name: 'Theme Palette' })).getAllByRole(
      'button',
    );
    expect(theme).toHaveLength(themePresetColors(getTheme('ocean')).length);
    // Before the standard colours.
    const colours = screen.getByRole('group', { name: 'Standard Colours' });
    expect(
      screen.getByRole('group', { name: 'Theme Palette' }).compareDocumentPosition(colours) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('leaves out of Custom colours a colour the Theme Palette already offers', () => {
    const themeHex = themePresetColors(getTheme('ocean'))[0]!.toLowerCase();
    inEditor({ yours: [themeHex, '#123456'] });
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(yours).toEqual(['#123456', 'Add a custom colour']);
  });

  it('shows a surface’s own Theme Palette instead, and none outside the editor', () => {
    inEditor({ theme: [{ id: 'slot-1', colour: '#ff0000', label: 'Red' }] });
    expect(
      within(screen.getByRole('group', { name: 'Theme Palette' })).getAllByRole('button'),
    ).toHaveLength(1);
    cleanup();
    render(<ColourPicker label="Colour" value={null} onPick={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Theme Palette' })).toBeNull();
  });
});

describe('a colour picked with +', () => {
  it('joins the document’s custom colours, then is picked', () => {
    const addCustomColour = vi.fn();
    const onPick = vi.fn();
    render(
      <EditorContext.Provider value={{ tabs: [], addCustomColour } as never}>
        <ColourPicker label="Colour" value={null} onPick={onPick} />
      </EditorContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), {
      target: { value: '#ABCDEF' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(addCustomColour).toHaveBeenCalledWith('#abcdef');
    expect(onPick).toHaveBeenCalledWith('#abcdef');
    // Focus goes back to +, never to the page, where Escape would reach the canvas.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Add a custom colour' }),
    );
  });

  it('records nothing for a swatch picked from the groups', () => {
    const addCustomColour = vi.fn();
    render(
      <EditorContext.Provider value={{ tabs: [], addCustomColour } as never}>
        <ColourPicker
          label="Colour"
          value={null}
          onPick={vi.fn()}
          standard={[standardGroup('strong', 'light', 'hex')]}
        />
      </EditorContext.Provider>,
    );
    const standard = screen.getByRole('group', { name: 'Standard Colours' });
    fireEvent.click(within(standard).getByRole('button', { name: 'Blue' }));
    expect(addCustomColour).not.toHaveBeenCalled();
  });
});

describe('stableColours', () => {
  it('keeps the shown order, puts new colours first, caps, and returns shown when unchanged', () => {
    const shown = ['#a', '#b', '#c'];
    expect(stableColours(shown, ['#c', '#a'], 12)).toBe(shown);
    expect(stableColours(shown, ['#d', '#c'], 12)).toEqual(['#d', '#a', '#b', '#c']);
    expect(stableColours(shown, ['#d', '#e'], 4)).toEqual(['#d', '#e', '#a', '#b']);
  });
});
