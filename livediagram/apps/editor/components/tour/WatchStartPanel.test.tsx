// @vitest-environment jsdom
// Watch It Built's start panel (docs/specs/007-editor/watch-it-built.md "The start panel"): in the player's place, the
// mode's topics to pick from, focus on the first as it opens, and Not Now or Escape to close it.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WatchStartPanel } from './WatchStartPanel';

afterEach(cleanup);

const topics = [
  { id: 'a', title: 'The Basics', line: 'Add shapes.', taken: false },
  { id: 'b', title: 'Look and Feel', line: 'A new look.', taken: true },
];
const mount = (onPick = vi.fn(), onClose = vi.fn()) => {
  render(
    <WatchStartPanel
      topics={topics}
      canvasRef={{ current: null }}
      onPick={onPick}
      onClose={onClose}
    />,
  );
  return { onPick, onClose };
};

describe('WatchStartPanel', () => {
  it('asks what to learn and focuses the first topic', () => {
    mount();
    expect(screen.getByRole('dialog', { name: 'Watch It Built' })).toBeTruthy();
    expect(screen.getByText('What would you like to learn?')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-tour-topic')).toBe('a');
  });

  it('picks a topic', () => {
    const { onPick } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Look and Feel/ }));
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('closes on Not Now and on Escape, and ignores other keys', () => {
    const { onClose } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
