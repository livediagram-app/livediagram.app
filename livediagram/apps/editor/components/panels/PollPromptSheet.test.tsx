// @vitest-environment jsdom

// The poll sheet is non-modal (docs/specs/012-collaboration/live-poll.md), so its window-level Escape-to-skip
// shares the key with the work behind it. An Escape another handler claimed
// (a label edit, the format painter, a deselect) must not also skip the poll.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LivePoll } from '@livediagram/api-schema';
import { PollPromptSheet } from './PollPromptSheet';

afterEach(cleanup);

const POLL: LivePoll = {
  id: 'poll-1',
  question: 'Which one?',
  style: 'choice',
  options: ['A', 'B'],
  startedAt: 0,
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const escape = () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));

describe('PollPromptSheet Escape', () => {
  it('skips the poll on an unclaimed Escape', async () => {
    const onAnswer = vi.fn();
    render(<PollPromptSheet poll={POLL} onAnswer={onAnswer} />);
    escape();
    await flush();
    expect(onAnswer).toHaveBeenCalledWith(null);
  });

  it('leaves the poll alone when a listener that attached later claims the key', async () => {
    const onAnswer = vi.fn();
    render(<PollPromptSheet poll={POLL} onAnswer={onAnswer} />);
    // Attached after the sheet, like the format painter's mode listener.
    const claim = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener('keydown', claim);
    escape();
    await flush();
    window.removeEventListener('keydown', claim);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('leaves the poll alone while a contentEditable label has focus', async () => {
    const onAnswer = vi.fn();
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    // jsdom doesn't derive isContentEditable from the attribute.
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    editor.tabIndex = 0;
    document.body.appendChild(editor);
    editor.focus();
    render(<PollPromptSheet poll={POLL} onAnswer={onAnswer} />);
    escape();
    await flush();
    editor.remove();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
