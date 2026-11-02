// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoDraftBar } from './PhotoDraftBar';

const base = {
  busy: false,
  onAccept: vi.fn(),
  onDiscard: vi.fn(),
};

describe('PhotoDraftBar', () => {
  it('says how many were read, new and matched', () => {
    render(<PhotoDraftBar {...base} draftCount={3} read={5} matchedCount={2} />);
    expect(screen.getByText(/5 read · 3 new · 2 already on the board/)).toBeTruthy();
  });

  it('says the reader failed and the words are the author’s to type', () => {
    render(
      <PhotoDraftBar {...base} draftCount={4} read={4} readError="ai_quota" matchedCount={0} />,
    );
    expect(
      screen.getByText(
        /4 found · the model key has used up its quota · type the words in yourself/,
      ),
    ).toBeTruthy();
  });

  it('still offers Add and Discard after a failed read', () => {
    render(
      <PhotoDraftBar {...base} draftCount={2} read={2} readError="ai_error" matchedCount={0} />,
    );
    expect(screen.getByRole('button', { name: /^Add 2 notes$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Discard$/ })).toBeTruthy();
  });
});
