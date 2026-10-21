// @vitest-environment jsdom

// The Sequence dialog (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog").

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@liveplanner/document';
import { SequenceDialog, type SequenceRows } from './SequenceDialog';
import { sequenceDialog } from '@/lib/sequence-dialog-handle';
import { setActiveTour } from '@/lib/tour-active';

afterEach(cleanup);

const seq = (over: Partial<ShapeElement> = {}) =>
  ({ ...createShape('sequence', 0, 0), id: 'q', ...over }) as ShapeElement;

function open(element = seq()) {
  const onCommit = vi.fn<(rows: SequenceRows, type: string) => void>();
  const onNumbered = vi.fn();
  const onClose = vi.fn();
  render(
    <SequenceDialog
      element={element}
      onCommit={onCommit}
      onNumbered={onNumbered}
      onClose={onClose}
    />,
  );
  const stored = () => onCommit.mock.calls.at(-1)?.[0];
  return { onCommit, onNumbered, onClose, stored };
}
const words = (n: number) => screen.getByRole('textbox', { name: `Message ${n} words` });

describe('SequenceDialog', () => {
  it('lists the participants as chips and the messages as numbered rows, with a preview', () => {
    open();
    const strip = screen.getByRole('region', { name: 'Participants' });
    expect(
      within(strip)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Browser', 'API', 'Database', 'Add Participant']);
    expect((words(1) as HTMLInputElement).value).toBe('Place order');
    expect(screen.getByText('5 of 60')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: /^Sequence diagram: Browser, API, Database/ }),
    ).toBeTruthy();
  });

  it('stores words on blur, once, and skips a blur that changed nothing', () => {
    const { onCommit, stored } = open();
    fireEvent.change(words(1), { target: { value: 'Checkout' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(words(1));
    expect(stored()!.messages[0]!.label).toBe('Checkout');
    fireEvent.blur(words(1));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('Enter adds the next message from the receiver, focused; Backspace in an empty one removes it', () => {
    const { stored } = open();
    fireEvent.keyDown(words(1), { key: 'Enter' });
    expect(stored()!.messages[1]).toEqual({ from: 'api', to: 'db', label: '', kind: 'call' });
    expect(document.activeElement).toBe(words(2));
    fireEvent.keyDown(words(2), { key: 'Backspace' });
    expect(stored()!.messages).toHaveLength(5);
    expect(document.activeElement).toBe(words(1));
  });

  it('cycles a message kind from its arrow', () => {
    const { stored } = open();
    fireEvent.click(screen.getByRole('button', { name: /^Message 1 kind: Call/ }));
    expect(stored()!.messages[0]!.kind).toBe('async');
  });

  it('removing a participant takes its messages, and two participants stay', () => {
    const { stored } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Database' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Database' }));
    expect(stored()!.participants.map((p) => p.id)).toEqual(['browser', 'api']);
    expect(stored()!.messages).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'API' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remove API' }).disabled).toBe(
      true,
    );
  });

  it('Add Participant picks a name no other participant has', () => {
    const { stored } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Database' }));
    const name = screen.getByRole('textbox', { name: 'Participant name' });
    fireEvent.change(name, { target: { value: 'Participant 4' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Participant' }));
    expect(stored()!.participants.map((p) => p.label)).toEqual([
      'Browser',
      'API',
      'Participant 4',
      'Participant 5',
    ]);
  });

  it('renames a participant on Enter and makes one an actor', () => {
    const { stored } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Browser' }));
    const name = screen.getByRole('textbox', { name: 'Participant name' });
    fireEvent.change(name, { target: { value: 'Shopper' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(stored()!.participants[0]).toEqual({ id: 'browser', label: 'Shopper' });
    fireEvent.click(screen.getByRole('button', { name: 'Shopper' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Actor' }));
    expect(stored()!.participants[0]).toEqual({ id: 'browser', label: 'Shopper', actor: true });
  });

  it('carries the rows to Text and back, storing the text on blur', () => {
    const { stored } = open();
    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
    const text = screen.getByRole('textbox', { name: 'The sequence, one line each' });
    expect((text as HTMLTextAreaElement).value).toContain('Browser -> API: Place order');
    fireEvent.change(text, { target: { value: 'actor User\nUser -> API: Hi\nnonsense' } });
    expect(screen.getByRole('status').textContent).toContain('Line 3 was not read.');
    fireEvent.blur(text);
    expect(stored()!.participants.map((p) => [p.label, !!p.actor])).toEqual([
      ['User', true],
      ['API', false],
    ]);
    expect(stored()!.participants[1]!.id).toBe('api');
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));
    expect((words(1) as HTMLInputElement).value).toBe('Hi');
  });

  it('keeps the last good rows when the text names fewer than two participants', () => {
    const { onCommit } = open();
    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
    const text = screen.getByRole('textbox', { name: 'The sequence, one line each' });
    fireEvent.change(text, { target: { value: 'participant Solo' } });
    expect(screen.getByRole('status').textContent).toContain('A diagram needs two participants.');
    fireEvent.blur(text);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('stores what is being typed when it closes, and Numbered writes at once', () => {
    const { stored, onClose, onNumbered } = open();
    fireEvent.change(words(2), { target: { value: 'Reserve stock' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Numbered' }));
    expect(onNumbered).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(stored()!.messages[1]!.label).toBe('Reserve stock');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state with no messages, and Add Message starts one', () => {
    const { stored } = open(seq({ sequenceMessages: [] }));
    expect(screen.getByText('No messages yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Add Message/ }));
    expect(stored()!.messages).toEqual([{ from: 'browser', to: 'api', label: '', kind: 'call' }]);
  });
});

// The Sequence element tour runs steps inside this dialog (docs/specs/007-editor/element-tours.md "The Sequence tour").
describe('SequenceDialog under the element tour', () => {
  afterEach(() => setActiveTour('element', false));

  it('marks what the tour points at', () => {
    open();
    for (const id of [
      'sequence-participants',
      'sequence-messages',
      'sequence-kind',
      'sequence-add-message',
      'sequence-preview',
      'sequence-numbered',
    ])
      expect(document.querySelector(`[data-tour-id="${id}"]`), id).not.toBeNull();
    expect(document.querySelectorAll('[data-tour-id="sequence-kind"]')).toHaveLength(1);
  });

  it('lets the tour switch its tabs and close it as Done does, storing what is typed', () => {
    const { onClose, onCommit } = open();
    act(() => sequenceDialog.showText());
    expect(document.querySelector('[data-tour-id="sequence-text"]')).not.toBeNull();
    act(() => sequenceDialog.showMessages());
    expect(document.querySelector('[data-tour-id="sequence-text"]')).toBeNull();
    fireEvent.change(words(1), { target: { value: 'Checkout' } });
    act(() => sequenceDialog.close());
    expect(onClose).toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalled();
    cleanup();
    expect(() => sequenceDialog.close()).not.toThrow();
  });

  it('keeps Escape from closing it while the element tour runs', () => {
    act(() => setActiveTour('element', true));
    const { onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
