// @vitest-environment jsdom

// The shared composer (docs/specs/012-collaboration/qa-board.md, idea-box.md):
// a post the board refused keeps its draft, and a full board says so instead
// of taking text it will drop.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollabComposer } from './CollabComposer';
import { QaComposer } from './qa/QaComposer';

afterEach(cleanup);

const field = () => screen.getByRole('textbox') as HTMLInputElement;
const type = (text: string) => fireEvent.change(field(), { target: { value: text } });
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send' }));

const composer = (onSubmit: () => boolean | void | Promise<boolean>, full?: string) =>
  render(
    <CollabComposer
      textColor="#000"
      placeholder="Add…"
      ariaLabel="Add"
      sendLabel="Send"
      maxLength={100}
      full={full}
      onSubmit={onSubmit}
    />,
  );

describe('CollabComposer', () => {
  it('clears the draft once the post is taken', () => {
    composer(() => true);
    type('Coffee');
    send();
    expect(field().value).toBe('');
  });

  it('keeps the draft when the post was refused', () => {
    const onSubmit = vi.fn(() => false);
    composer(onSubmit);
    type('Coffee');
    send();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field().value).toBe('Coffee');
  });

  // docs/specs/012-collaboration/qa-board.md: a post the server refused because the board filled meanwhile.
  it('puts the draft back when the server refuses the post', async () => {
    let answer: (ok: boolean) => void = () => {};
    composer(() => new Promise<boolean>((resolve) => (answer = resolve)));
    type('Coffee ');
    send();
    expect(field().value).toBe('');
    await act(async () => answer(false));
    expect(field().value).toBe('Coffee ');
  });

  it('keeps what was typed since over a refused draft, and clears for a taken one', async () => {
    let answer: (ok: boolean) => void = () => {};
    composer(() => new Promise<boolean>((resolve) => (answer = resolve)));
    type('Coffee');
    send();
    type('Tea');
    await act(async () => answer(false));
    expect(field().value).toBe('Tea');
    send();
    await act(async () => answer(true));
    expect(field().value).toBe('');
  });

  it('turns off and says why when the board is full', () => {
    const onSubmit = vi.fn();
    composer(onSubmit, 'Box is full');
    expect(field().disabled).toBe(true);
    expect(field().placeholder).toBe('Box is full');
    expect(field().getAttribute('aria-label')).toBe('Add: Box is full');
    send();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('QaComposer', () => {
  it('names the Anonymous switch the same in both states', () => {
    render(<QaComposer textColor="#000" selfName="Sam" onAdd={vi.fn(() => true)} />);
    const toggle = screen.getByRole('switch', { name: 'Anonymous' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByRole('switch', { name: 'Anonymous' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('says the board is full', () => {
    render(<QaComposer textColor="#000" selfName="Sam" full onAdd={vi.fn(() => true)} />);
    expect(field().placeholder).toBe('Board is full');
  });
});
