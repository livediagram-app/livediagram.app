// @vitest-environment jsdom
// The colour wells that used to be the OS colour input, now the one colour picker
// (docs/specs/004-interface-design/colour-picker.md): the canvas and pattern colours, and the
// rich-text toolbar's text colour.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { penColourHex, standardColours } from '@livehuddle/document';
import { ColorSwatch } from './palette-controls';
import { RichTextToolbar } from '@/components/canvas/RichTextToolbar';

describe('ColorSwatch (canvas and pattern colours)', () => {
  it('opens the picker with soft then strong colours, and a pick closes it', () => {
    const onChange = vi.fn();
    render(<ColorSwatch label="Canvas" value="#ffffff" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Canvas colour' }));
    const soft = within(screen.getByRole('group', { name: 'Light' })).getAllByRole('button');
    expect(soft.map((b) => b.getAttribute('aria-label'))).toEqual(
      standardColours('soft', 'light').map((c) => c.label),
    );
    expect(soft[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Dark' })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Dark' })).getByRole('button', {
        name: 'Blue',
      }),
    );
    expect(onChange).toHaveBeenCalledWith(penColourHex('blue', 'light'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers the strong tone alone where it is ink (the pattern)', () => {
    render(<ColorSwatch label="Pattern" value="#cbd5e1" onChange={vi.fn()} tones={['strong']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pattern colour' }));
    expect(screen.getByRole('group', { name: 'Standard Colours' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Light' })).toBeNull();
    // A colour off the standard set shows as the custom colour in force.
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    expect(yours[0]!.getAttribute('aria-label')).toBe('#cbd5e1');
  });
});

describe('the rich-text toolbar', () => {
  it('colours the selection from the picker without stealing focus on press', () => {
    const onColor = vi.fn();
    render(
      <RichTextToolbar
        active={
          {
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            heading: null,
            color: undefined,
          } as never
        }
        alignX="center"
        alignY="middle"
        onToggle={vi.fn()}
        onApplyList={vi.fn()}
        onApplyHeading={vi.fn()}
        listStyle={'none'}
        onColor={onColor}
        onSetAlign={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Text colour' });
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Violet' }));
    expect(onColor).toHaveBeenCalledWith(penColourHex('violet', 'light'));
  });
});
