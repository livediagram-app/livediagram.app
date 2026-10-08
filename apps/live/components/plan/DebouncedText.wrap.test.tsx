// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebouncedText } from './item-field-editors';

afterEach(cleanup);

// docs/specs/026-plan/plan-board.md "Look": the card panel's title wraps to three lines, as one line of text.
describe('a wrapping one-line field (the card title)', () => {
  const draw = (onSave = vi.fn(), onEnter = vi.fn()) => {
    render(
      <DebouncedText
        id="t"
        label="Title"
        value="A title"
        wrapLines={3}
        onEnter={onEnter}
        disabled={false}
        onSave={onSave}
        className="title"
      />,
    );
    return { onSave, onEnter, field: screen.getByLabelText('Title') as HTMLTextAreaElement };
  };

  it('is a one-row textarea, so it wraps without keeping room it does not need', () => {
    const { field } = draw();
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.rows).toBe(1);
    expect(field.className).toContain('resize-none');
  });

  it('turns a pasted line break into a space', () => {
    const { field } = draw();
    fireEvent.change(field, { target: { value: 'First line\nsecond line' } });
    expect(field.value).toBe('First line second line');
  });

  it('saves and moves on with Enter, never adding a line', async () => {
    const onSave = vi.fn(() => true);
    const { field, onEnter } = draw(onSave);
    fireEvent.change(field, { target: { value: 'Renamed' } });
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    expect(onSave).toHaveBeenCalledWith('Renamed');
    expect(onEnter).toHaveBeenCalled();
    expect(field.value).toBe('Renamed');
  });
});
