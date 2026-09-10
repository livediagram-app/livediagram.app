// @vitest-environment jsdom

// The Picker's reel (spec/107). Rendered rather than tested as a pure helper
// for the same reason useTimelineFeed.test.tsx is (spec/18): the behaviour
// under test — "a result arriving from the room replays the spin here, our own
// does not replay it twice" — lives entirely in effect + ref lifecycle, and no
// pure function can see it.
//
// The reel itself (which frames, in what order, at what delays) IS pure and is
// covered by lib/picker.test.ts; this only pins WHEN one runs.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PICKER_SPIN_MS, type PickerCandidate } from '@/lib/picker';
import { PickerFace } from './PickerFace';

const CANDIDATES: PickerCandidate[] = [{ label: 'Alex' }, { label: 'Sam' }, { label: 'Priya' }];

// The name the face is showing right now — mid-reel it is whichever frame is
// on screen, at rest it is the settled result. Read off the live region, which
// is the element whose whole job is to announce exactly this.
function shown(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '';
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

// True while a reel is running: the button reads "Picking…" only then. The
// reel's first frame is scheduled at 0ms rather than painted synchronously, so
// callers advance a tick before asking.
function spinning(): boolean {
  return !!screen.queryByText('Picking…');
}

function runReelToCompletion(): void {
  advance(PICKER_SPIN_MS + 50);
}

describe('PickerFace', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    // Explicit: this workspace runs vitest without `globals`, so
    // @testing-library's auto-cleanup afterEach is never registered and each
    // render would otherwise stack another face onto the same document.
    cleanup();
    vi.useRealTimers();
  });

  it('replays a peer’s roll as a spin instead of just showing the answer', () => {
    // The bug: everyone but the presser saw the new name appear with no roll,
    // which is the one moment a picker has.
    const onRoll = vi.fn(() => ({ label: 'Alex' }) as PickerCandidate);
    const props = { label: 'Who demos?', candidates: CANDIDATES, textColor: '#000', shared: true };
    const view = render(<PickerFace {...props} result={undefined} onRoll={onRoll} />);
    expect(spinning()).toBe(false);

    view.rerender(<PickerFace {...props} result="Sam" onRoll={onRoll} />);
    // The reel is running, and it is a reel — not the answer pasted in.
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    // Nobody here pressed anything: this spin is the room's roll arriving.
    expect(onRoll).not.toHaveBeenCalled();

    runReelToCompletion();
    expect(spinning()).toBe(false);
    // Everyone lands on what the element says, whatever their reel showed.
    expect(shown()).toBe('Sam');
  });

  it('does not replay our own roll a second time', () => {
    const onRoll = vi.fn(() => ({ label: 'Alex' }) as PickerCandidate);
    const view = render(
      <PickerFace
        label="Who demos?"
        result={undefined}
        candidates={CANDIDATES}
        textColor="#000"
        shared
        onRoll={onRoll}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: 'Pick at random' }).click();
    });
    // Our press wrote the result, which comes back to us as a prop — the spin
    // our press already started must not start over. The prop is applied LATE
    // in the reel on purpose: applied at the top, a wrongly-restarted reel
    // would finish at almost the same moment as the right one and the test
    // could not tell them apart. Near the end, a restart is still running.
    advance(PICKER_SPIN_MS - 100);
    view.rerender(
      <PickerFace
        label="Who demos?"
        result="Alex"
        candidates={CANDIDATES}
        textColor="#000"
        shared
        onRoll={onRoll}
      />,
    );
    advance(200);
    expect(spinning()).toBe(false);
    expect(shown()).toBe('Alex');
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  it('still spins when a peer later lands on the name we once rolled', () => {
    // The reason the skip holds a VALUE and is spent on the next change: a
    // boolean flag (or one left armed) would swallow this roll silently.
    const onRoll = vi.fn(() => ({ label: 'Alex' }) as PickerCandidate);
    const props = { label: 'Who demos?', candidates: CANDIDATES, textColor: '#000', shared: true };
    const view = render(<PickerFace {...props} result={undefined} onRoll={onRoll} />);
    act(() => {
      screen.getByRole('button', { name: 'Pick at random' }).click();
    });
    view.rerender(<PickerFace {...props} result="Alex" onRoll={onRoll} />);
    runReelToCompletion();

    // A peer rolls Sam, then Alex again. Both are the room's, so both spin.
    view.rerender(<PickerFace {...props} result="Sam" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    runReelToCompletion();

    view.rerender(<PickerFace {...props} result="Alex" onRoll={onRoll} />);
    advance(PICKER_SPIN_MS / 2);
    expect(spinning()).toBe(true);
    runReelToCompletion();
    expect(shown()).toBe('Alex');
  });

  it('shows a result that was already there without spinning', () => {
    // Joining a diagram somebody already rolled on is not a roll happening.
    render(
      <PickerFace label="Who demos?" result="Priya" candidates={CANDIDATES} textColor="#000" />,
    );
    expect(spinning()).toBe(false);
    expect(shown()).toBe('Priya');
  });

  it('does not spin when the result is cleared', () => {
    // An undo or a reset has no landing to watch.
    const props = { label: 'Who demos?', candidates: CANDIDATES, textColor: '#000' };
    const view = render(<PickerFace {...props} result="Sam" />);
    view.rerender(<PickerFace {...props} result={undefined} />);
    expect(spinning()).toBe(false);
    expect(shown()).toBe('—');
  });
});
