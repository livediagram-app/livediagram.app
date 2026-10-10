// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slide, Tab } from '@livediagram/document';
import { DEFAULT_PRESENTATION_CONFIG, type PresentationConfig } from '@/lib/presentation-config';
import { announce } from '@/lib/announcer';
import { PresentationOverlay, type PresentationStep } from './PresentationOverlay';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/announcer', () => ({ announce: vi.fn() }));

// The running deck (docs/specs/012-collaboration/presentation-mode.md): its keys, its pacing readout and
// the tool it hands back on the way out.

const tab = { id: 't1', name: 'Tab', elements: [] } as unknown as Tab;
const slide = (id: string): Slide => ({ id, elementIds: [], minutes: 1 }) as unknown as Slide;
const STEPS: PresentationStep[] = [
  { slide: slide('a'), tab, index: 0 },
  { slide: slide('b'), tab, index: 1 },
];

function Deck(props: {
  onExit?: () => void;
  onSetCanvasTool?: (tool: 'laser' | 'spotlight' | 'select') => void;
  canvasTool?: string;
  config?: Partial<PresentationConfig>;
}) {
  const [at, setAt] = useState(0);
  return (
    <PresentationOverlay
      steps={STEPS}
      canvasTool={props.canvasTool ?? 'select'}
      onSetCanvasTool={props.onSetCanvasTool ?? vi.fn()}
      at={at}
      onGo={setAt}
      onExit={props.onExit ?? vi.fn()}
      direction="forward"
      config={{ ...DEFAULT_PRESENTATION_CONFIG, ...props.config }}
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
// The budget readout: time on this slide against its minutes.
const budget = () => screen.getByText(/\/ 1:00/).textContent?.replace(/^.*: /, '');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PresentationOverlay', () => {
  it('counts time on the slide, and starts again on the next one', () => {
    render(<Deck config={{ showBudget: true }} />);
    tick(5000);
    expect(budget()).toBe('0:05 / 1:00');

    press('ArrowRight');
    tick(2000);
    expect(budget()).toBe('0:02 / 1:00');
  });

  it('keeps counting when a key goes nowhere', () => {
    // Home on the first slide is not a new slide, so the clock carries on.
    render(<Deck config={{ showBudget: true }} />);
    tick(5000);
    press('Home');
    tick(2000);
    expect(budget()).toBe('0:07 / 1:00');
  });

  it('steps through the deck from the keys', () => {
    render(<Deck />);
    expect(screen.getByText('1 / 2', { exact: false })).toBeTruthy();
    press('ArrowRight');
    expect(screen.getByText('2 / 2', { exact: false })).toBeTruthy();
    press('ArrowLeft');
    expect(screen.getByText('1 / 2', { exact: false })).toBeTruthy();
  });

  it('leaves Enter to a keyboard-focused control of the deck, and advances on it elsewhere', () => {
    render(<Deck />);
    const control = screen.getAllByRole('button')[0]!;
    const matches = Element.prototype.matches;
    // jsdom has no focus modality: answer `:focus-visible` for the control as a browser does after a Tab.
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, sel) {
      return sel === ':focus-visible' ? this === control : matches.call(this, sel);
    });
    act(() => {
      control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(screen.getByText('1 / 2', { exact: false })).toBeTruthy();
    press('Enter');
    expect(screen.getByText('2 / 2', { exact: false })).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('exits on Escape, and arms the laser on L', () => {
    const onExit = vi.fn();
    const onSetCanvasTool = vi.fn();
    render(<Deck onExit={onExit} onSetCanvasTool={onSetCanvasTool} />);
    press('l');
    expect(onSetCanvasTool).toHaveBeenLastCalledWith('laser');
    press('Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('puts the laser away on a second L', () => {
    // The key reads the tool as it is now, not as it was when the deck started.
    const calls: string[] = [];
    function LiveTool() {
      const [tool, setTool] = useState<string>('select');
      return (
        <Deck
          canvasTool={tool}
          onSetCanvasTool={(next) => {
            calls.push(next);
            setTool(next);
          }}
        />
      );
    }
    render(<LiveTool />);
    press('l');
    press('l');
    expect(calls).toEqual(['laser', 'select']);
  });

  it('puts the pointer back on the way out', () => {
    const onSetCanvasTool = vi.fn();
    const { unmount } = render(<Deck onSetCanvasTool={onSetCanvasTool} />);
    expect(onSetCanvasTool).not.toHaveBeenCalled();
    unmount();
    expect(onSetCanvasTool).toHaveBeenCalledWith('select');
  });

  it('auto-advances on time while the deck re-renders, whatever onGo it is handed', () => {
    const onGo = vi.fn();
    const deck = (n: number) => (
      <PresentationOverlay
        steps={[...STEPS]}
        canvasTool="select"
        onSetCanvasTool={vi.fn()}
        at={0}
        // A fresh closure every render, as a parent re-rendering for other reasons hands over.
        onGo={(next) => onGo(next, n)}
        onExit={vi.fn()}
        direction="forward"
        config={{ ...DEFAULT_PRESENTATION_CONFIG, autoAdvanceSeconds: 2 }}
        onChangeConfig={vi.fn()}
      />
    );
    const { rerender } = render(deck(0));
    for (let n = 1; n <= 4; n++) {
      tick(500);
      rerender(deck(n));
    }
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onGo.mock.calls[0]![0]).toBe(1);
  });

  it('says the slide when it changes, not on every edit to the deck', () => {
    const say = vi.mocked(announce);
    say.mockClear();
    const deck = (steps: PresentationStep[], at = 0) => (
      <PresentationOverlay
        steps={steps}
        canvasTool="select"
        onSetCanvasTool={vi.fn()}
        at={at}
        onGo={vi.fn()}
        onExit={vi.fn()}
        direction="forward"
        config={DEFAULT_PRESENTATION_CONFIG}
        onChangeConfig={vi.fn()}
      />
    );
    const { rerender } = render(deck(STEPS));
    expect(say).toHaveBeenCalledTimes(1);
    // An edit somewhere in the deck: a new list, the same slide on screen.
    rerender(deck(STEPS.map((x) => ({ ...x }))));
    rerender(deck(STEPS.map((x) => ({ ...x }))));
    expect(say).toHaveBeenCalledTimes(1);
    rerender(deck(STEPS, 1));
    expect(say).toHaveBeenLastCalledWith('Slide 2 of 2');
  });

  it('leaves a pointing tool armed at Start in hand on the way out', () => {
    const onSetCanvasTool = vi.fn();
    const { unmount } = render(<Deck canvasTool="laser" onSetCanvasTool={onSetCanvasTool} />);
    unmount();
    expect(onSetCanvasTool).not.toHaveBeenCalled();
  });
});
