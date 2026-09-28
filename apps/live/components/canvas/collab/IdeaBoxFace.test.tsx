// @vitest-environment jsdom

// The Idea box face (docs/specs/012-collaboration/idea-box.md, "Closed and open" and "The look"): a closed
// box shows a count and never the text, an open one shows every idea, ideas
// go in from the composer at the foot, and it says it is anonymous.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/diagram';
import { IdeaBoxFace } from './IdeaBoxFace';

afterEach(cleanup);

const box = (o: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'ib',
  type: 'shape',
  shape: 'idea-box',
  x: 0,
  y: 0,
  width: 300,
  height: 320,
  ...o,
});

const show = (el: ShapeElement, handlers: Partial<Parameters<typeof IdeaBoxFace>[0]> = {}) =>
  render(
    <IdeaBoxFace
      element={el}
      label="What slowed us down?"
      textColor="#0f172a"
      surface="#ffffff"
      {...handlers}
    />,
  );

describe('IdeaBoxFace', () => {
  it('keeps a closed box sealed: the count, never the text', () => {
    show(box({ ideaCards: ['Flaky CI', 'Too many meetings'] }), { onReveal: vi.fn() });
    expect(screen.getByText('ideas sealed')).toBeTruthy();
    expect(screen.queryByText('Flaky CI')).toBeNull();
    expect(screen.getByText('Open the box')).toBeTruthy();
    expect(screen.queryByText(/Open the box \(/)).toBeNull();
  });

  it('shows every idea once open, and offers the scatter instead', () => {
    show(box({ ideaCards: ['Flaky CI'], ideasRevealed: true }), {
      onReveal: vi.fn(),
      onScatter: vi.fn(),
    });
    expect(screen.getByText('Flaky CI')).toBeTruthy();
    expect(screen.queryByText(/Open the box/)).toBeNull();
    expect(screen.getByText('Scatter to sticky notes')).toBeTruthy();
  });

  it('adds an idea from the composer, which says it is anonymous', () => {
    const onAddIdea = vi.fn();
    show(box(), { onAddIdea });
    expect(screen.getByText('Anonymous')).toBeTruthy();
    const field = screen.getByLabelText('Add an anonymous idea');
    fireEvent.change(field, { target: { value: '  Ship smaller  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onAddIdea).toHaveBeenCalledWith('Ship smaller');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('invites the first idea when empty, and has no composer for a viewer', () => {
    show(box());
    expect(screen.getByText('Nothing in the box yet')).toBeTruthy();
    expect(screen.queryByText(/Be the first/)).toBeNull();
    expect(screen.queryByLabelText('Add an anonymous idea')).toBeNull();
  });
});
