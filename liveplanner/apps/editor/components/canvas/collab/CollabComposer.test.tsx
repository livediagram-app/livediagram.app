// @vitest-environment jsdom

// The shared composer (docs/specs/012-collaboration/comment-pin.md): a post clears the draft, and an empty
// draft sends nothing.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollabComposer } from './CollabComposer';

afterEach(cleanup);

const field = () => screen.getByRole<HTMLInputElement>('textbox');
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send' }));

const composer = (onSubmit: () => void) =>
  render(
    <CollabComposer
      textColor="#000"
      placeholder="Add…"
      ariaLabel="Add"
      sendLabel="Send"
      maxLength={100}
      onSubmit={onSubmit}
    />,
  );

describe('CollabComposer', () => {
  it('clears the draft once the post is sent', () => {
    const onSubmit = vi.fn();
    composer(onSubmit);
    type('Coffee');
    send();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field().value).toBe('');
  });

  it('sends nothing for an empty draft', () => {
    const onSubmit = vi.fn();
    composer(onSubmit);
    type('   ');
    send();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
