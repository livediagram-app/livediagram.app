// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slide, Tab } from '@livediagram/document';
import { DEFAULT_PRESENTATION_CONFIG, type PresentationConfig } from '@/lib/presentation-config';
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

  it('leaves a pointing tool armed at Start in hand on the way out', () => {
    const onSetCanvasTool = vi.fn();
    const { unmount } = render(<Deck canvasTool="laser" onSetCanvasTool={onSetCanvasTool} />);
    unmount();
    expect(onSetCanvasTool).not.toHaveBeenCalled();
  });
});
