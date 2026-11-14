// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slide, Tab } from '@livedocuments/document';
import { DEFAULT_PRESENTATION_CONFIG } from '@/lib/presentation-config';
import { announce } from '@liveworkspace/workbench/lib/announcer';
import { PresentationOverlay, type PresentationStep } from './PresentationOverlay';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/announcer', () => ({ announce: vi.fn() }));

// docs/specs/012-collaboration/presentation-mode.md "Builds", the overlay's part: Back is offered while a build shows,
// each build restarts the auto-advance timer, a build played forward is announced, and the note card stays put.

const tab = { id: 't1', name: 'Tab', elements: [] } as unknown as Tab;
const slide = (id: string, notes?: string[]): Slide =>
  ({
    id,
    elementIds: [],
    ...(notes ? { noteCards: notes.map((text, i) => ({ id: `${id}${i}`, text })) } : {}),
  }) as unknown as Slide;
const STEPS: PresentationStep[] = [
  { slide: slide('a', ['First card', 'Second card']), tab, index: 0 },
  { slide: slide('b'), tab, index: 1 },
];

// A stand-in host: slide `a` has two builds, played before the deck moves on.
function Deck({ autoAdvanceSeconds = 0 }: { autoAdvanceSeconds?: number }) {
  const [pos, setPos] = useState({ at: 0, shown: 0 });
  const count = pos.at === 0 ? 2 : 0;
  const onGo = (next: number, step?: 1 | -1) => {
    if (step === 1 && pos.shown < count) {
      setPos({ at: pos.at, shown: pos.shown + 1 });
      return pos.at;
    }
    if (step === -1 && pos.shown > 0) {
      setPos({ at: pos.at, shown: pos.shown - 1 });
      return pos.at;
    }
    const at = Math.max(0, Math.min(next, STEPS.length));
    setPos({ at, shown: step === -1 && at === 0 ? 2 : 0 });
    return at;
  };
  return (
    <PresentationOverlay
      steps={STEPS}
      canvasTool="select"
      onSetCanvasTool={vi.fn()}
      at={pos.at}
      build={{ shown: pos.shown, count }}
      onGo={onGo}
      onExit={vi.fn()}
      direction="forward"
      config={{ ...DEFAULT_PRESENTATION_CONFIG, autoAdvanceSeconds }}
      onChangeConfig={vi.fn()}
    />
  );
}

const press = (key: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const back = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Previous slide' });
const position = () => screen.getByText(/\d \/ 2/).textContent;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(announce).mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PresentationOverlay builds', () => {
  it('offers Back on the first slide while a build shows', () => {
    render(<Deck />);
    expect(back().disabled).toBe(true);
    press('ArrowRight');
    expect(back().disabled).toBe(false);
    press('ArrowLeft');
    expect(back().disabled).toBe(true);
  });

  it('announces a build played forward, and nothing when one is taken back', () => {
    render(<Deck />);
    press('ArrowRight');
    expect(announce).toHaveBeenLastCalledWith('Build 1 of 2');
    press('ArrowRight');
    expect(announce).toHaveBeenLastCalledWith('Build 2 of 2');
    vi.mocked(announce).mockClear();
    press('ArrowLeft');
    expect(announce).not.toHaveBeenCalled();
  });

  it('restarts the auto-advance timer on each build, so the slide builds before it moves on', () => {
    render(<Deck autoAdvanceSeconds={2} />);
    tick(2000);
    expect(announce).toHaveBeenLastCalledWith('Build 1 of 2');
    tick(2000);
    expect(announce).toHaveBeenLastCalledWith('Build 2 of 2');
    expect(position()).toContain('1 / 2');
    tick(2000);
    expect(position()).toContain('2 / 2');
  });

  it('keeps the note card in front through a build', () => {
    render(<Deck />);
    press('n');
    press('ArrowDown');
    expect(screen.getByText('Second card')).toBeTruthy();
    press('ArrowRight');
    expect(screen.getByText('Second card')).toBeTruthy();
  });
});
