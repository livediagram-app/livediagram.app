import { describe, expect, it } from 'vitest';
import { splitConfirmMessage } from './ConfirmPopover';

// A confirmation reads as a question and a quieter detail, never one block of text.

describe('splitConfirmMessage', () => {
  it('makes the question the title and the rest the detail', () => {
    expect(splitConfirmMessage('Delete “Roadmap” for good? This cannot be undone.')).toEqual({
      title: 'Delete “Roadmap” for good?',
      detail: 'This cannot be undone.',
    });
  });

  it('keeps a message without a question whole', () => {
    expect(splitConfirmMessage('Revoke this token.')).toEqual({
      title: 'Revoke this token.',
      detail: '',
    });
  });
});
