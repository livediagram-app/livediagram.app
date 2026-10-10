// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebouncedText } from './item-field-editors';

// docs/specs/026-plan/items.md "Limits": a field stops at its limit and never keeps a value that was refused.
afterEach(cleanup);

describe('a debounced text field', () => {
  it('goes back to what is saved when a save is refused', async () => {
    const onSave = vi.fn(async () => false);
    render(<DebouncedText id="t" label="Title" value="Old" disabled={false} onSave={onSave} />);
    const box = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'New' } });
    await act(async () => {
      fireEvent.blur(box);
    });
    expect(onSave).toHaveBeenCalledWith('New');
    expect(box.value).toBe('Old');
  });

  it('saves typing still waiting on the debounce when the field goes (Escape closing its card)', () => {
    const onSave = vi.fn(async () => true);
    const { unmount } = render(
      <DebouncedText id="t" label="Title" value="Old" disabled={false} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Typed fast' } });
    expect(onSave).not.toHaveBeenCalled();
    unmount();
    expect(onSave).toHaveBeenCalledWith('Typed fast');
  });

  it('keeps a save that lands', async () => {
    render(
      <DebouncedText id="t" label="Title" value="Old" disabled={false} onSave={async () => true} />,
    );
    const box = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'New' } });
    await act(async () => {
      fireEvent.blur(box);
    });
    expect(box.value).toBe('New');
  });

  it('caps typing at its limit and counts down near it', () => {
    render(
      <DebouncedText
        id="t"
        label="Title"
        value={'x'.repeat(9)}
        maxLength={10}
        disabled={false}
        onSave={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Title') as HTMLInputElement).maxLength).toBe(10);
    expect(screen.getByText('1 character left')).toBeTruthy();
  });

  it('on Enter saves and then runs onEnter, but not when the save is refused', async () => {
    const onEnter = vi.fn();
    const { rerender } = render(
      <DebouncedText
        id="t"
        label="Title"
        value="Old"
        disabled={false}
        onSave={async () => true}
        onEnter={onEnter}
      />,
    );
    const box = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'New' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(onEnter).toHaveBeenCalledTimes(1);
    rerender(
      <DebouncedText
        id="t"
        label="Title"
        value="New"
        disabled={false}
        onSave={async () => false}
        onEnter={onEnter}
      />,
    );
    fireEvent.change(box, { target: { value: 'Newer' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
