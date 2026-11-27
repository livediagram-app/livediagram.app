// @vitest-environment jsdom

// The Picker's face (docs/specs/012-collaboration/picker.md). Rendered rather than tested as pure helpers
// because the behaviour under test (a result arriving from the room replays the spin here, our own
// does not replay twice, a Reset puts the names back) lives in effect and ref lifecycle.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PICKER_SPIN_MS, type PickerCandidate } from '../../../lib/picker';
import { PickerFace } from './PickerFace';

const CANDIDATES: PickerCandidate[] = [{ label: 'Alex' }, { label: 'Sam' }, { label: 'Priya' }];
const BASE = {
  label: 'Who demos?',
  candidates: CANDIDATES,
  textColor: '#0f172a',
  width: 240,
  height: 176,
};
type Props = ComponentProps<typeof PickerFace>;

// What the face announces: the landing, never a frame flicking past.
const shown = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '';
const state = () =>
  document.querySelector('[data-picker-state]')?.getAttribute('data-picker-state');
const spinning = () => state() === 'spinning';
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const land = () => advance(PICKER_SPIN_MS + 50);
const spin = () => fireEvent.click(screen.getByRole('button', { name: 'Pick at random' }));

describe('PickerFace', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    // This workspace runs vitest without `globals`, so each render is cleaned up by hand.
    cleanup();
    vi.useRealTimers();
    document.documentElement.classList.remove('reduce-motion');
  });

  it('replays a peer’s roll as a spin instead of just showing the answer', () => {
    const onRoll = vi.fn(() => ({ label: 'Alex' }));
    const view = render(<PickerFace {...BASE} shared result={undefined} onRoll={onRoll} />);
    expect(state()).toBe('ready');
    view.rerender(<PickerFace {...BASE} shared result="Sam" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    // Nothing announced mid-reel, and nobody here pressed anything.
    expect(shown()).toBe('');
    expect(onRoll).not.toHaveBeenCalled();
    land();
    expect(state()).toBe('landed');
    expect(shown()).toBe('Sam');
  });

  it('does not replay our own roll a second time', () => {
    const onRoll = vi.fn(() => ({ label: 'Alex' }));
    const view = render(<PickerFace {...BASE} shared result={undefined} onRoll={onRoll} />);
    spin();
    expect(screen.getByText('Spinning…')).toBeTruthy();
    // Our write comes back as a prop late in the reel: a restarted reel would still be running.
    advance(PICKER_SPIN_MS - 100);
    view.rerender(<PickerFace {...BASE} shared result="Alex" onRoll={onRoll} />);
    advance(200);
    expect(spinning()).toBe(false);
    expect(shown()).toBe('Alex');
    expect(onRoll).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Spin Again')).toBeTruthy();
  });

  it('still spins when a peer later lands on the name we once rolled', () => {
    const onRoll = vi.fn(() => ({ label: 'Alex' }));
    const view = render(<PickerFace {...BASE} shared result={undefined} onRoll={onRoll} />);
    spin();
    view.rerender(<PickerFace {...BASE} shared result="Alex" onRoll={onRoll} />);
    land();
    view.rerender(<PickerFace {...BASE} shared result="Sam" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    land();
    view.rerender(<PickerFace {...BASE} shared result="Alex" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    land();
    expect(shown()).toBe('Alex');
  });

  it('does not let a private roll swallow the room’s next landing', () => {
    // An Editor rolling for themselves (shared false) writes nothing, so arms no skip.
    const onRoll = vi.fn(() => ({ label: 'Sam' }));
    const view = render(<PickerFace {...BASE} result={undefined} onRoll={onRoll} />);
    spin();
    land();
    view.rerender(<PickerFace {...BASE} result="Sam" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
  });

  it('keeps a private roll on our payline until the room’s result next changes', () => {
    const view = render(<PickerFace {...BASE} result="Alex" onRoll={() => ({ label: 'Priya' })} />);
    spin();
    land();
    expect(shown()).toBe('Priya');
    expect(screen.getByText('Spin Again')).toBeTruthy();
    // The room's answer moves on: ours gives way, and the reel spins from where it stood.
    view.rerender(<PickerFace {...BASE} result="Sam" onRoll={() => ({ label: 'Priya' })} />);
    expect(spinning()).toBe(true);
    land();
    expect(shown()).toBe('Sam');
  });

  it('shows a result that was already there without spinning, and no spin on a clear', () => {
    const view = render(<PickerFace {...BASE} result="Priya" />);
    expect(spinning()).toBe(false);
    expect(shown()).toBe('Priya');
    view.rerender(<PickerFace {...BASE} result={undefined} />);
    expect(spinning()).toBe(false);
    expect(state()).toBe('ready');
  });

  it('ignores a press while the reel is turning, and a roll with nothing to land on', () => {
    const onRoll = vi.fn<() => PickerCandidate | null>(() => null);
    render(<PickerFace {...BASE} shared result={undefined} onRoll={onRoll} />);
    spin();
    expect(spinning()).toBe(false);
    onRoll.mockImplementation(() => ({ label: 'Sam' }));
    spin();
    expect(spinning()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Spinning' }));
    expect(onRoll).toHaveBeenCalledTimes(2);
  });

  it('keeps a winner who has left the room, and spins to a peer’s pick this client cannot see', () => {
    const view = render(<PickerFace {...BASE} result="Zed" />);
    expect(shown()).toBe('Zed');
    view.rerender(<PickerFace {...BASE} result="Yan" />);
    expect(spinning()).toBe(true);
    land();
    expect(shown()).toBe('Yan');
  });

  it('leaves the header out with neither a label nor a count', () => {
    render(<PickerFace {...BASE} label=" " candidates={[]} source="options" result={undefined} />);
    expect(document.querySelector('.uppercase')).toBeNull();
  });

  it('gives a viewer the reel and the count but no buttons', () => {
    render(<PickerFace {...BASE} source="options" result="Sam" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('3 options')).toBeTruthy();
    expect(screen.getByText('Who demos?')).toBeTruthy();
  });

  it('says how many people are here, and when there is nothing to pick from', () => {
    const view = render(<PickerFace {...BASE} result={undefined} onRoll={() => null} />);
    expect(screen.getByText('3 here')).toBeTruthy();
    view.rerender(
      <PickerFace
        {...BASE}
        candidates={[]}
        source="options"
        result={undefined}
        onRoll={() => null}
      />,
    );
    expect(screen.getByText('Nothing to pick from')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Pick at random' }).disabled).toBe(
      true,
    );
  });

  describe('Remove Once Drawn', () => {
    const round = (over: Partial<Props>) => (
      <PickerFace
        {...BASE}
        source="options"
        removeDrawn
        shared
        result={undefined}
        onRoll={() => ({ label: 'Priya' })}
        onReset={() => {}}
        {...over}
      />
    );

    it('counts what is left and lists who has had a turn', () => {
      render(round({ drawn: ['Alex', 'Sam'], result: 'Sam', height: 240 }));
      expect(screen.getByText('1 of 3 left')).toBeTruthy();
      // The name on the payline is not repeated in the drawn list.
      const list = screen.getByRole('list', { name: 'Already drawn' });
      expect(list.textContent).toBe('Alex');
    });

    it('folds a long drawn list into "+N more"', () => {
      const many = Array.from({ length: 9 }, (_, i) => ({ label: `P${i}` }));
      render(
        round({
          candidates: many,
          drawn: many.slice(0, 8).map((c) => c.label),
          height: 260,
        }),
      );
      expect(screen.getByText('+2 more')).toBeTruthy();
    });

    it('offers Reset beside Spin once anything is drawn, and calls it', () => {
      const onReset = vi.fn();
      render(round({ drawn: ['Alex'], result: 'Alex', onReset }));
      fireEvent.click(screen.getByRole('button', { name: 'Reset the draw' }));
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Pick at random' })).toBeTruthy();
    });

    it('says when every name is drawn and puts Reset in place of Spin', () => {
      render(round({ drawn: ['Alex', 'Sam', 'Priya'], result: 'Priya' }));
      expect(state()).toBe('all-drawn');
      expect(screen.getByText('All drawn')).toBeTruthy();
      expect(screen.getByText('Every option is drawn')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Pick at random' })).toBeNull();
      expect(screen.getByText('Reset')).toBeTruthy();
    });

    it('tells the room the people have all had a turn, and a viewer to wait', () => {
      render(<PickerFace {...BASE} removeDrawn drawn={['Alex', 'Sam', 'Priya']} result="Priya" />);
      expect(screen.getByText(/Everyone’s had a turn\. Waiting for a reset\./)).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('spins a peer’s last draw even though the pool is now empty', () => {
      const view = render(round({ drawn: ['Alex', 'Sam'], result: 'Sam' }));
      view.rerender(round({ drawn: ['Alex', 'Sam', 'Priya'], result: 'Priya' }));
      advance(PICKER_SPIN_MS / 2);
      expect(spinning()).toBe(true);
      land();
      expect(state()).toBe('all-drawn');
      expect(shown()).toBe('Priya');
    });

    it('gives a private roller no Reset once all are drawn, and none before anything is', () => {
      const view = render(round({ drawn: ['Alex', 'Sam', 'Priya'], onReset: undefined }));
      expect(screen.queryByRole('button')).toBeNull();
      view.rerender(round({ drawn: undefined }));
      expect(screen.queryByRole('button', { name: 'Reset the draw' })).toBeNull();
      expect(screen.getByText('3 of 3 left')).toBeTruthy();
    });

    it('ignores drawn names while the setting is off', () => {
      render(round({ removeDrawn: false, drawn: ['Alex', 'Sam', 'Priya'] }));
      expect(screen.getByText('3 options')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Reset the draw' })).toBeNull();
    });
  });

  it('draws people with the avatar the editor renders', () => {
    const people = [
      { label: 'Ada', participant: { id: 'p1', name: 'Ada' } },
      { label: 'Grace', participant: { id: 'p2', name: 'Grace' } },
    ];
    const renderAvatar = vi.fn((p: { name: string }, size: number) => (
      <i data-avatar={p.name} data-size={size} />
    ));
    render(<PickerFace {...BASE} candidates={people} result="Ada" renderAvatar={renderAvatar} />);
    expect(document.querySelector('[data-avatar="Ada"]')).toBeTruthy();
  });

  it('lands almost at once under Reduce motion', () => {
    document.documentElement.classList.add('reduce-motion');
    const view = render(<PickerFace {...BASE} result={undefined} />);
    view.rerender(<PickerFace {...BASE} result="Sam" />);
    expect(spinning()).toBe(true);
    advance(300);
    expect(spinning()).toBe(false);
    expect(shown()).toBe('Sam');
  });

  it('keeps the payline alone on a short card, and drops the header on a tiny one', () => {
    const view = render(<PickerFace {...BASE} height={100} result="Sam" onRoll={() => null} />);
    expect(document.querySelector('.picker-window-single')).toBeTruthy();
    expect(screen.getByText('Who demos?')).toBeTruthy();
    view.rerender(<PickerFace {...BASE} height={70} result="Sam" />);
    expect(screen.queryByText('Who demos?')).toBeNull();
  });

  it('takes the accent from the element’s stroke', () => {
    render(<PickerFace {...BASE} strokeColor="#db2777" result="Sam" />);
    const root = document.querySelector<HTMLElement>('[data-picker-state]')!;
    expect(root.style.getPropertyValue('--picker-accent')).toBe('#db2777');
  });
});
