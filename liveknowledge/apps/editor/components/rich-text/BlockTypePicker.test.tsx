// @vitest-environment jsdom

// The label's Title and Caption entry (docs/specs/009-elements/block-type-picker.md "Title and Caption").

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockTypePicker } from './BlockTypePicker';

afterEach(cleanup);

const show = (onApplyTitleCaption?: () => void) => {
  render(
    <BlockTypePicker
      heading={null}
      listStyle="none"
      onApplyHeading={() => {}}
      onApplyList={() => {}}
      onApplyTitleCaption={onApplyTitleCaption}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Block type' }));
};

describe('BlockTypePicker', () => {
  it('offers Title and Caption in a label, and applies it', () => {
    const apply = vi.fn();
    show(apply);
    fireEvent.click(screen.getByRole('option', { name: 'Title and Caption' }));
    expect(apply).toHaveBeenCalledOnce();
  });

  it('leaves it out where no preset is wired (the note toolbar)', () => {
    show();
    expect(screen.queryByRole('option', { name: 'Title and Caption' })).toBeNull();
  });
});
