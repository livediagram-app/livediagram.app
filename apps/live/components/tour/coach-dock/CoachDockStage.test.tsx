// @vitest-environment jsdom
// The coach dock's states (docs/specs/007-editor/coach-dock.md, blueprints/coach-dock.md "Behaviour and state"):
// the offer and its fold into the tour chip, a step with its count, Try it, Back and End Tour, the pointer, and the
// closing that folds away as completed. The engine is a stand-in, so each state is set directly.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from '../tour-step';
import type { TourEngine } from '../useTourEngine';
import {
  OFFER_FOLD_MS,
  RING_PAD_IN_DIALOG_PX,
  RING_PAD_PX,
  TRY_IT_ADVANCE_MS,
} from './coach-dock-copy';
import { CoachChipSlot, CoachDockSlot } from './CoachDockSlots';
import { CoachDockStage } from './CoachDockStage';

type Api = { pageId: string };
const welcome: TourStepOf<Api> = {
  id: 'welcome',
  card: 'welcome',
  title: 'New to slides?',
  body: 'A quick look.',
};
const layouts: TourStepOf<Api> = {
  id: 'layouts',
  title: 'Choose a Layout',
  body: 'Press one.',
  target: 'layouts',
  tryIt: { label: 'Pick any layout', pressed: (api) => `[data-tile="${api.pageId}"]` },
};
const plus: TourStepOf<Api> = { id: 'add', title: 'Add Another Slide', body: '+.', target: 'add' };
const outro: TourStepOf<Api> = {
  id: 'outro',
  card: 'outro',
  title: "You're ready",
  body: 'Go.',
};

const engine = (over: Partial<TourEngine<Api>> = {}): TourEngine<Api> => ({
  active: true,
  step: welcome,
  stepIndex: 0,
  stepDir: 'forward',
  targetRect: null,
  yielded: false,
  countableSteps: 2,
  hasWelcome: true,
  start: vi.fn(),
  stop: vi.fn(),
  next: vi.fn(),
  back: vi.fn(),
  skip: vi.fn(),
  ...over,
});

const onFolded = vi.fn();
const onChipStart = vi.fn();
function Stage({ e }: { e: TourEngine<Api> }) {
  return (
    <>
      <CoachDockStage
        engine={e}
        api={{ pageId: 'p1' }}
        eyebrow="Slides tour"
        help={{ href: '/help/slides/', label: 'Slide Pages Help' }}
        finish="Start"
        chip={{ label: 'Slides Tour', about: 'A short tour.' }}
        onFolded={onFolded}
        onChipStart={onChipStart}
      />
      <CoachDockSlot />
      <div data-editor-tabbar="">
        <CoachChipSlot />
      </div>
    </>
  );
}

const dock = () => document.querySelector<HTMLElement>('[data-coach-dock]');
const chip = () => document.querySelector<HTMLElement>('[data-coach-chip]');

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('the offer', () => {
  it('stands in the dock slot, with its length, Take the Tour and No Thanks', () => {
    const e = engine();
    render(<Stage e={e} />);
    expect(dock()?.closest('[data-coach-dock-slot]')).not.toBeNull();
    expect(dock()?.dataset.coachDock).toBe('offer');
    expect(dock()?.textContent).toContain('2 stops, about a minute');
    fireEvent.click(screen.getByRole('button', { name: 'Take the Tour' }));
    expect(e.next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No Thanks' }));
    expect(e.skip).toHaveBeenCalled();
  });

  it('is a labelled region that never takes focus', () => {
    render(<Stage e={engine()} />);
    expect(screen.getByRole('region', { name: 'Slides tour' })).toBe(dock());
    expect(document.activeElement).toBe(document.body);
  });

  it('folds into the chip in the tab bar when left alone, which is no answer', () => {
    const e = engine();
    render(<Stage e={e} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS - 1);
    });
    expect(dock()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(dock()).toBeNull();
    expect(chip()?.closest('[data-coach-chip-slot]')).not.toBeNull();
    expect(onFolded).toHaveBeenCalledTimes(1);
    expect(e.skip).not.toHaveBeenCalled();
  });

  it('waits while a mouse moves over it, then gives a full fold time again', () => {
    render(<Stage e={engine()} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS - 100);
    });
    // A pointer resting where the dock appeared, or a touch, holds nothing.
    fireEvent.pointerEnter(dock()!);
    fireEvent.pointerMove(dock()!, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerMove(dock()!, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS * 2);
    });
    expect(dock()).not.toBeNull();
    fireEvent.pointerLeave(dock()!);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS - 1);
    });
    expect(dock()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(chip()).not.toBeNull();
  });

  it('the chip starts the tour, or dismisses it for good', () => {
    const e = engine();
    render(<Stage e={e} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Slides Tour' }));
    expect(onChipStart).toHaveBeenCalled();
    expect(e.next).toHaveBeenCalled();
    cleanup();
    const f = engine();
    render(<Stage e={f} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'No Thanks: hide the Slides Tour' }));
    expect(f.skip).toHaveBeenCalled();
  });

  it('a new offer starts unfolded', () => {
    const { rerender } = render(<Stage e={engine()} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    expect(chip()).not.toBeNull();
    rerender(<Stage e={engine({ active: false, step: undefined })} />);
    rerender(<Stage e={engine()} />);
    expect(dock()?.dataset.coachDock).toBe('offer');
  });

  it('Escape from inside the dock declines; Escape elsewhere is the page’s', () => {
    const e = engine();
    render(<Stage e={e} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(e.skip).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Take the Tour' }).focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(e.skip).toHaveBeenCalled();
  });

  it('sets the dock floor and quiets the sign-in banner while it shows, and clears both after', () => {
    const { unmount } = render(<Stage e={engine()} />);
    expect(document.documentElement.style.getPropertyValue('--coach-dock-floor')).not.toBe('');
    expect(document.body.hasAttribute('data-tour-card-open')).toBe(true);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--coach-dock-floor')).toBe('');
    expect(document.body.hasAttribute('data-tour-card-open')).toBe(false);
  });
});

describe('a step', () => {
  const at = (step: TourStepOf<Api>, stepIndex: number, over: Partial<TourEngine<Api>> = {}) =>
    engine({
      step,
      stepIndex,
      targetRect: { left: 100, top: 100, width: 40, height: 20 },
      ...over,
    });

  it('counts itself, shows progress, and offers Back only from the second', () => {
    const e = at(layouts, 1);
    const { rerender } = render(<Stage e={e} />);
    expect(dock()?.textContent).toContain('1 of 2');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
    const f = at(plus, 2);
    rerender(<Stage e={f} />);
    expect(dock()?.textContent).toContain('2 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(f.back).toHaveBeenCalled();
    // The last counted step finishes.
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(f.next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'End Tour' }));
    expect(f.skip).toHaveBeenCalled();
  });

  it('announces its number and title politely', () => {
    render(<Stage e={at(layouts, 1)} />);
    expect(dock()?.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Slides tour, step 1 of 2: Choose a Layout',
    );
  });

  it('rings its control, with no dim, and drops the ring while a dialog has it step aside', () => {
    const { rerender } = render(<Stage e={at(layouts, 1)} />);
    const ring = document.querySelector<HTMLElement>('[data-coach-ring]');
    expect(ring?.style.left).toBe('94px');
    expect(ring?.style.boxShadow).toBe('');
    // The step's number on the ring's corner, as the dock counts it.
    const badge = document.querySelector<HTMLElement>('[data-coach-badge]');
    expect(badge?.textContent).toBe('1');
    expect(badge?.style.left).toBe('84px');
    rerender(<Stage e={at(layouts, 1, { yielded: true })} />);
    expect(document.querySelector('[data-coach-ring]')).toBeNull();
    expect(document.querySelector('[data-coach-badge]')).toBeNull();
    expect(dock()).not.toBeNull();
  });

  it('never folds', () => {
    render(<Stage e={at(layouts, 1)} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS * 3);
    });
    expect(dock()?.dataset.coachDock).toBe('step');
  });

  it('Try it ticks on its own press and moves on a beat later', () => {
    const e = at(layouts, 1);
    const tile = document.createElement('button');
    tile.dataset.tile = 'p1';
    const other = document.createElement('button');
    document.body.append(tile, other);
    render(<Stage e={e} />);
    expect(dock()?.textContent).toContain('Try it: Pick any layout');
    fireEvent.click(other);
    expect(dock()?.querySelector('[data-try-it="todo"]')).not.toBeNull();
    fireEvent.click(tile);
    expect(dock()?.querySelector('[data-try-it="done"]')?.textContent).toContain('Done');
    act(() => {
      vi.advanceTimersByTime(TRY_IT_ADVANCE_MS - 1);
    });
    expect(e.next).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(e.next).toHaveBeenCalledTimes(1);
    tile.remove();
    other.remove();
  });

  it('a step changed during the beat is not advanced twice', () => {
    const e = at(layouts, 1);
    const tile = document.createElement('button');
    tile.dataset.tile = 'p1';
    document.body.append(tile);
    const { rerender } = render(<Stage e={e} />);
    fireEvent.click(tile);
    rerender(<Stage e={at(plus, 2, { next: e.next })} />);
    act(() => {
      vi.advanceTimersByTime(TRY_IT_ADVANCE_MS * 2);
    });
    expect(e.next).not.toHaveBeenCalled();
    tile.remove();
  });

  it('a step without a Try it shows none', () => {
    render(<Stage e={at(plus, 2)} />);
    expect(dock()?.querySelector('[data-try-it]')).toBeNull();
  });
});

describe('the closing', () => {
  it('links the help and finishes on Start, or folds away as completed', () => {
    const e = engine({ step: outro, stepIndex: 3 });
    render(<Stage e={e} />);
    expect(dock()?.dataset.coachDock).toBe('closing');
    expect(screen.getByRole('link', { name: 'Slide Pages Help' }).getAttribute('href')).toBe(
      '/help/slides/',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(e.next).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    expect(e.next).toHaveBeenCalledTimes(2);
    expect(onFolded).not.toHaveBeenCalled();
  });
});

describe('nothing to show', () => {
  it('draws nothing while the tour is not running', () => {
    render(<Stage e={engine({ active: false, step: undefined })} />);
    expect(dock()).toBeNull();
    expect(chip()).toBeNull();
  });
});

describe('the step badge', () => {
  it('stays inside the window for a control at its very corner', () => {
    render(
      <Stage
        e={engine({
          step: layouts,
          stepIndex: 1,
          targetRect: { left: 0, top: 0, width: 30, height: 30 },
        })}
      />,
    );
    const badge = document.querySelector<HTMLElement>('[data-coach-badge]')!;
    expect(badge.style.left).toBe('4px');
    expect(badge.style.top).toBe('4px');
  });
});

describe('without slots', () => {
  it('the dock stands at the bottom of the window, and a folded chip at its corner', () => {
    render(
      <CoachDockStage
        engine={engine()}
        api={{ pageId: 'p1' }}
        eyebrow="Slides tour"
        help={{ href: '/help/', label: 'Help' }}
        finish="Start"
        chip={{ label: 'Slides Tour', about: 'A short tour.' }}
      />,
    );
    expect(dock()?.parentElement?.className).toContain('fixed');
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    expect(chip()?.parentElement?.className).toContain('fixed');
  });

  it('a chip with no tab bar sits in the dock slot', () => {
    render(
      <>
        <CoachDockStage
          engine={engine()}
          api={{ pageId: 'p1' }}
          eyebrow="Slides tour"
          help={{ href: '/help/', label: 'Help' }}
          finish="Start"
          chip={{ label: 'Slides Tour', about: 'A short tour.' }}
        />
        <CoachDockSlot />
      </>,
    );
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    expect(chip()?.closest('[data-coach-dock-slot]')).not.toBeNull();
  });
});

describe('keyboard and focus', () => {
  const escapeFrom = (name: string) => {
    screen.getByRole('button', { name }).focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  };

  it('Escape from inside ends a step, and finishes from the closing', () => {
    const e = engine({ step: layouts, stepIndex: 1 });
    const { rerender } = render(<Stage e={e} />);
    escapeFrom('Next');
    expect(e.skip).toHaveBeenCalledTimes(1);
    const f = engine({ step: outro, stepIndex: 3 });
    rerender(<Stage e={f} />);
    escapeFrom('Start');
    expect(f.next).toHaveBeenCalledTimes(1);
  });

  it('an Escape something else already took is left alone', () => {
    const e = engine();
    render(<Stage e={e} />);
    const button = screen.getByRole('button', { name: 'Take the Tour' });
    button.focus();
    const taken = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    taken.preventDefault();
    button.dispatchEvent(taken);
    expect(e.skip).not.toHaveBeenCalled();
  });

  it('focus inside the dock holds the fold, and moving within it keeps holding', () => {
    render(<Stage e={engine()} />);
    const take = screen.getByRole('button', { name: 'Take the Tour' });
    const no = screen.getByRole('button', { name: 'No Thanks' });
    fireEvent.focus(take);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS * 2);
    });
    fireEvent.blur(take, { relatedTarget: no });
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS * 2);
    });
    expect(dock()).not.toBeNull();
    fireEvent.blur(no, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    expect(chip()).not.toBeNull();
  });

  it('a press on the dock or the chip is the tour’s, never the page’s', () => {
    const outside = vi.fn();
    document.addEventListener('pointerdown', outside);
    render(<Stage e={engine()} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Take the Tour' }));
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Slides Tour' }));
    document.removeEventListener('pointerdown', outside);
    expect(outside).not.toHaveBeenCalled();
  });
});

// Every tour draws through the dock (spec "Every tour speaks through it"): the Plan tour's offer of two ways in, and a
// Show Me (or an element tour's step) inside a dialog.
describe('choices and dialogs', () => {
  function ChoiceStage({ e, onPick }: { e: TourEngine<Api>; onPick: (id: string) => void }) {
    return (
      <>
        <CoachDockStage
          engine={e}
          eyebrow="Boards and Sheets tour"
          help={{ href: '/help/plan/', label: 'Boards Help' }}
          finish="Start"
          chip={{ label: 'Plan Tour', about: 'Your board or your sheet.' }}
          choices={[
            { id: 'boards', label: 'Boards', onPick: () => onPick('boards') },
            { id: 'sheets', label: 'Spreadsheets', onPick: () => onPick('sheets') },
          ]}
        />
        <CoachDockSlot />
        <div data-editor-tabbar="">
          <CoachChipSlot />
        </div>
      </>
    );
  }

  it('offers each choice in place of Take the Tour, with No Thanks beside them', () => {
    const onPick = vi.fn();
    const e = engine();
    render(<ChoiceStage e={e} onPick={onPick} />);
    expect(screen.queryByRole('button', { name: 'Take the Tour' })).toBeNull();
    expect(screen.getByRole('button', { name: 'No Thanks' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Spreadsheets' }));
    expect(onPick).toHaveBeenCalledWith('sheets');
    expect(e.next).not.toHaveBeenCalled();
  });

  it('opens the offer again from the chip, to be chosen from, rather than starting a track', () => {
    const e = engine();
    render(<ChoiceStage e={e} onPick={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(OFFER_FOLD_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Plan Tour' }));
    expect(e.next).not.toHaveBeenCalled();
    expect(dock()?.dataset.coachDock).toBe('offer');
    expect(screen.getByRole('button', { name: 'Boards' })).toBeTruthy();
  });

  function DialogStage({ e }: { e: TourEngine<Api> }) {
    return (
      <>
        <CoachDockStage
          engine={e}
          eyebrow="Show Me · Card Types"
          help={{ href: '/help/card-types/', label: 'Card Types Help' }}
          finish="Done"
          layer="modal"
        />
        <CoachDockSlot />
      </>
    );
  }
  const rect = { left: 100, top: 100, width: 50, height: 20 };

  it('stands a dialog tour at the window bottom over the dim, ringing its controls roomier', () => {
    render(
      <DialogStage e={engine({ step: plus, stepIndex: 0, hasWelcome: false, targetRect: rect })} />,
    );
    expect(dock()?.closest('[data-coach-dock-slot]')).toBeNull();
    expect(dock()?.parentElement?.className).toContain('fixed');
    expect(dock()?.parentElement?.className).toContain('z-[var(--z-toast)]');
    const ring = document.querySelector<HTMLElement>('[data-coach-ring]')!;
    expect(ring.style.left).toBe(`${rect.left - RING_PAD_IN_DIALOG_PX}px`);
    expect(ring.className).toContain('z-[calc(var(--z-modal)+1)]');
  });

  it('stands a dialog tour’s closing over the dim too', () => {
    render(<DialogStage e={engine({ step: outro, stepIndex: 1, hasWelcome: false })} />);
    expect(dock()?.dataset.coachDock).toBe('closing');
    expect(dock()?.closest('[data-coach-dock-slot]')).toBeNull();
  });

  it('lifts one step of an editor tour over a dialog it opened, and back into the slot after', () => {
    const inDialog: TourStepOf<Api> = { ...plus, id: 'data', layer: 'modal' };
    const { rerender } = render(
      <Stage e={engine({ step: inDialog, stepIndex: 1, targetRect: rect })} />,
    );
    expect(dock()?.closest('[data-coach-dock-slot]')).toBeNull();
    const ring = document.querySelector<HTMLElement>('[data-coach-ring]')!;
    // An editor tour keeps its own ring room, even over a dialog.
    expect(ring.style.left).toBe(`${rect.left - RING_PAD_PX}px`);
    rerender(<Stage e={engine({ step: plus, stepIndex: 1, targetRect: rect })} />);
    expect(dock()?.closest('[data-coach-dock-slot]')).not.toBeNull();
  });

  it('leaves out a Try it it has no facade to resolve', () => {
    const e = engine({ step: layouts, stepIndex: 1 });
    render(
      <CoachDockStage
        engine={e}
        eyebrow="Draw tour"
        help={{ href: '/help/draw/', label: 'Draw Help' }}
        finish="Start"
      />,
    );
    expect(dock()?.dataset.coachDock).toBe('step');
    expect(document.querySelector('[data-try-it]')).toBeNull();
  });
});
