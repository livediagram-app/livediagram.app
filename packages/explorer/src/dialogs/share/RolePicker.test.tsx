import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Level } from '@liveworkspace/index-client';
import { LEVEL_PASS } from './parts';
import { RolePicker } from './RolePicker';

function Picker() {
  const [level, setLevel] = useState<Level>('view');
  return <RolePicker level={level} onChange={setLevel} />;
}

const card = () => screen.getByRole('button', { name: /^Pass level:/ });

// Folding the levels makes them inert, so focus on one must go back to the card rather than to the page.
describe('RolePicker', () => {
  it('hands focus back to the card when Escape folds the levels', () => {
    render(<Picker />);
    fireEvent.click(card());
    const participant = screen.getByRole('button', { name: /Participant/ });
    participant.focus();
    fireEvent.keyDown(participant, { key: 'Escape' });
    expect(card().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(card());
  });

  it('hands focus back to the card when a level is chosen', () => {
    render(<Picker />);
    fireEvent.click(card());
    const editor = screen.getByRole('button', { name: /Editor/ });
    editor.focus();
    fireEvent.click(editor);
    expect(card().getAttribute('aria-label')).toBe('Pass level: Editor. Change level');
    expect(document.activeElement).toBe(card());
  });

  it('lists only the levels it can switch to, never the chosen one', () => {
    render(<Picker />);
    fireEvent.click(card());
    const levels = [...document.querySelectorAll('[data-level]')].map((b) =>
      b.getAttribute('data-level'),
    );
    expect(levels).toEqual(['edit', 'participate']);
  });

  // An app's own blurb (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): livehuddle's Participant, and
  // the shared words everywhere else.
  it("words a level in the app's own blurb where it has one", () => {
    const { unmount } = render(
      <RolePicker
        level="participate"
        onChange={() => {}}
        levels={['edit', 'participate']}
        app="livehuddle"
      />,
    );
    expect(screen.getAllByText('Walks, talks and uses the pieces; adds nothing.').length).toBe(1);
    expect(screen.getByText('Works with you in real time.')).toBeTruthy();
    unmount();
    render(<RolePicker level="participate" onChange={() => {}} app="livediagram" />);
    expect(screen.getAllByText(LEVEL_PASS.participate.blurb).length).toBe(1);
  });
});
