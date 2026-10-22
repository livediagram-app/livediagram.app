// @vitest-environment jsdom

// docs/specs/012-collaboration/comment-mentions.md "Writing a mention".

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollabComposer } from '@/components/canvas/collab/CollabComposer';
import type { MentionCandidate } from '@/hooks/collab/useCommentMentions';
import {
  MENTION_UNAVAILABLE_HINT,
  matchCandidates,
  mentionQueryAt,
} from './useMentionAutocomplete';

afterEach(cleanup);

const priya: MentionCandidate = {
  userId: 'u-priya',
  memberId: 'm-priya',
  name: 'Priya Kaur',
  handle: 'priya-kaur',
  pending: false,
};
const sam: MentionCandidate = {
  userId: null,
  memberId: 'm-sam',
  name: 'Sam Lee',
  handle: 'sam-lee',
  pending: true,
};

describe('mentionQueryAt', () => {
  it('finds the @query the caret ends, at the start or after a space', () => {
    expect(mentionQueryAt('@pri', 4)).toEqual({ start: 0, text: 'pri' });
    expect(mentionQueryAt('hi @Pri', 7)).toEqual({ start: 3, text: 'pri' });
    expect(mentionQueryAt('hi @', 4)).toEqual({ start: 3, text: '' });
  });

  it('ignores an email address and a finished word', () => {
    expect(mentionQueryAt('me@pri', 6)).toBeNull();
    expect(mentionQueryAt('@priya done', 11)).toBeNull();
  });
});

describe('matchCandidates', () => {
  it('matches the handle or any word of the name', () => {
    expect(matchCandidates([priya, sam], 'kau')).toEqual([priya]);
    expect(matchCandidates([priya, sam], 'sam-')).toEqual([sam]);
    expect(matchCandidates([priya, sam], '')).toEqual([priya, sam]);
  });
});

describe('mentions in the composer', () => {
  const setup = (available = true) => {
    const onSubmit = vi.fn();
    render(
      <CollabComposer
        textColor="#000"
        placeholder="Reply…"
        ariaLabel="Write a comment"
        sendLabel="Send comment"
        maxLength={5000}
        mentionScope={{ candidates: [priya, sam], available }}
        onSubmit={onSubmit}
      />,
    );
    const field = screen.getByLabelText('Write a comment') as HTMLInputElement;
    // The caret rides along, at the end of what was typed.
    const type = (value: string) =>
      fireEvent.change(field, {
        target: { value, selectionStart: value.length, selectionEnd: value.length },
      });
    return { field, type, onSubmit };
  };

  it('suggests teammates, picks with Enter, and sends the mention', () => {
    const { field, type, onSubmit } = setup();
    type('can you check @pri');
    expect(screen.getByRole('option', { name: /Priya Kaur/ })).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field.value).toBe('can you check @priya-kaur ');
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('can you check @priya-kaur', [
      { userId: 'u-priya', memberId: 'm-priya', name: 'Priya Kaur', handle: 'priya-kaur' },
    ]);
  });

  it('keeps the arrow-key highlight through the key release that follows it', () => {
    // The real browser order: keydown moves the highlight, keyup re-reads the
    // caret. The keyup used to reset the highlight to the first row.
    const { field, type, onSubmit } = setup();
    type('@');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    fireEvent.keyUp(field, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Sam Lee/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyUp(field, { key: 'Enter' });
    expect(field.value).toBe('@sam-lee ');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('@sam-lee', [
      { userId: null, memberId: 'm-sam', name: 'Sam Lee', handle: 'sam-lee' },
    ]);
  });

  it('starts from the top again when the query changes', () => {
    const { field, type } = setup();
    type('@');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    type('@s');
    type('@');
    expect(screen.getByRole('option', { name: /Priya Kaur/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('drops a picked mention whose handle was deleted before sending', () => {
    const { field, type, onSubmit } = setup();
    type('@sa');
    fireEvent.keyDown(field, { key: 'Enter' });
    type('never mind');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('never mind', []);
  });

  it('closes on Escape and leaves the text as typed', () => {
    const { field, type } = setup();
    type('@pri');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field.value).toBe('@pri');
  });

  it('explains why nobody can be mentioned on a personal document', () => {
    const { type } = setup(false);
    type('@');
    expect(screen.getByText(MENTION_UNAVAILABLE_HINT)).toBeTruthy();
  });
});
