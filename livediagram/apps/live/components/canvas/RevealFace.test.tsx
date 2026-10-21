// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevealFace } from './RevealFace';

afterEach(cleanup);

// Tailwind's pointer-events classes don't apply in jsdom, so read them off the
// tree: the nearest element (itself or an ancestor) that sets one decides.
function takesPointers(el: HTMLElement): boolean {
  for (let at: HTMLElement | null = el; at; at = at.parentElement) {
    if (at.classList.contains('pointer-events-auto')) return true;
    if (at.classList.contains('pointer-events-none')) return false;
  }
  return true;
}

const face = (props: Partial<Parameters<typeof RevealFace>[0]> = {}) => (
  <RevealFace
    label="Answers"
    textColor="#0f172a"
    strokeColor="#0ea5e9"
    revealedForAll={false}
    revealedForMe={false}
    {...props}
  />
);

// docs/specs/009-elements/reveal-zone.md "Two ways to uncover": a lift for yourself
// leaves a Hide pill that puts the cover back with one press.
describe('RevealFace', () => {
  it('lets the Hide pill take the press that puts the cover back', () => {
    const toggle = vi.fn();
    render(face({ revealedForMe: true, onToggleForMe: toggle }));
    const pill = screen.getByRole('button', { name: 'Hide' });
    // Inside the face's pointer-events-none layer the pill inherited none, so
    // a press fell through to the element and the cover never came back.
    expect(takesPointers(pill)).toBe(true);
    expect(takesPointers(pill.parentElement!)).toBe(false);
    fireEvent.click(pill);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('shows the cover, not the pill, until it is lifted', () => {
    render(face());
    expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull();
    expect(screen.getByRole('button', { name: /Answers, double-/ })).toBeTruthy();
  });

  it('draws nothing once it is revealed for everyone', () => {
    const { container } = render(face({ revealedForAll: true, revealedForMe: true }));
    expect(container.firstChild).toBeNull();
  });
});
