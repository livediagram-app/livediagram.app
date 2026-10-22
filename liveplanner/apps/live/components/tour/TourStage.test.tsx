// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from './tour-step';
import type { TourEngine } from './useTourEngine';
import { TourStage } from './TourStage';
import { holePath } from './TourSpotlight';
import { BoardsTourArt } from './art/plan-tour-art';
// The tour wears the active tab's colours (tour-colours.ts); outside an editor, a plain light palette.
vi.mock('@/components/start/useStartPalette', async () => {
  const { planPalette } = await import('@liveplanner/project');
  return { useStartPalette: () => planPalette('light') };
});

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), with a second tour's own
// card words (docs/specs/026-plan/plan-tour.md).

afterEach(cleanup);

function engine(step: TourStepOf<unknown>, over: Partial<TourEngine<unknown>> = {}) {
  return {
    active: true,
    step,
    stepIndex: step.card === 'outro' ? 3 : step.card ? 0 : 2,
    stepDir: 'forward',
    targetRect: null,
    yielded: false,
    landed: true,
    countableSteps: 2,
    hasWelcome: true,
    start: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    ...over,
  } as TourEngine<unknown>;
}

describe('TourStage', () => {
  it('draws nothing while the tour is not running', () => {
    const { container } = render(
      <TourStage engine={engine({ id: 'a', title: 'A', body: '' }, { active: false })} />,
    );
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('[data-tour-popover]')).toBeNull();
  });

  // docs/specs/007-editor/editor-tour.md "Dialogs come first".
  it('draws nothing while it has stepped aside for a dialog', () => {
    render(
      <TourStage
        engine={engine(
          { id: 'a', title: 'A', body: '', target: 'a' },
          { yielded: true, targetRect: { left: 0, top: 0, width: 10, height: 10 } },
        )}
      />,
    );
    expect(document.querySelector('[data-tour-popover]')).toBeNull();
    expect(document.body.querySelector('[aria-hidden]')).toBeNull();
  });

  it("wears the welcome tour's words by default", () => {
    const e = engine({ id: 'welcome', card: 'welcome', title: 'Welcome', body: 'Hi' });
    render(<TourStage engine={e} />);
    expect(screen.getByText('Diagram tour')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(e.next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(e.skip).toHaveBeenCalled();
  });

  it("wears a second tour's own words and art", () => {
    const welcome = engine({ id: 'welcome', card: 'welcome', title: 'Welcome to Plan', body: '' });
    const { unmount } = render(
      <TourStage
        engine={welcome}
        copy={{ welcomeEyebrow: 'Plan tour', finish: 'Start planning', helpHref: '/help/x/' }}
        welcomeArt={<BoardsTourArt />}
      />,
    );
    expect(screen.getByText('Plan tour')).toBeTruthy();
    unmount();
    render(
      <TourStage
        engine={engine({ id: 'outro', card: 'outro', title: 'Done', body: '' })}
        copy={{ finish: 'Start planning', helpHref: '/help/x/' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Start planning' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn More' }).getAttribute('href')).toBe('/help/x/');
  });

  it('offers each way in on a welcome card with choices, in place of the accept', () => {
    const e = engine({ id: 'welcome', card: 'welcome', title: 'Welcome to Plan', body: '' });
    const boards = vi.fn();
    const sheets = vi.fn();
    render(
      <TourStage
        engine={e}
        welcomeChoices={[
          { id: 'boards', label: 'Boards', onPick: boards },
          { id: 'sheets', label: 'Spreadsheets', onPick: sheets },
        ]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spreadsheets' }));
    expect(sheets).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Boards' }));
    expect(boards).toHaveBeenCalled();
    expect(e.next).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(e.skip).toHaveBeenCalled();
  });

  it('rings the target and labels the step with the tour', () => {
    const e = engine(
      { id: 'one', title: 'One', body: 'Copy' },
      { targetRect: { left: 10, top: 10, width: 50, height: 20 } },
    );
    render(<TourStage engine={e} ariaPrefix="Plan tour" />);
    expect(screen.getByRole('dialog', { name: 'Plan tour step 2 of 2: One' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(e.back).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(e.skip).toHaveBeenCalled();
  });

  // docs/specs/007-editor/editor-tour.md "Look": the spotlight dims round the target; the card wears the tab's colours.
  it("spotlights the target and paints the card in the tab's accent", async () => {
    const { planPalette } = await import('@liveplanner/project');
    const accent = planPalette('light').focus;
    const e = engine(
      { id: 'one', title: 'One', body: 'Copy' },
      { targetRect: { left: 10, top: 10, width: 50, height: 20 } },
    );
    render(<TourStage engine={e} ariaPrefix="Plan tour" />);
    expect(document.querySelector('[data-tour-spotlight]')).not.toBeNull();
    const card = document.querySelector<HTMLElement>('[data-tour-popover]')!;
    expect(card.style.getPropertyValue('--tour-accent')).toBe(accent);
    expect(card.style.getPropertyValue('--tour-on-accent')).toMatch(/^#/);
  });

  // Show Me (the card type editor) has no welcome card: its first step is "1 of N", with no Back.
  it('counts a tour without a welcome card from its first step, spotlit over a dialog', () => {
    const e = engine(
      { id: 'general', title: 'General', body: 'Copy' },
      {
        stepIndex: 0,
        countableSteps: 5,
        hasWelcome: false,
        targetRect: { left: 20, top: 20, width: 100, height: 40 },
      },
    );
    render(<TourStage engine={e} ariaPrefix="Show Me" layer="modal" pad={14} />);
    expect(screen.getByRole('dialog', { name: 'Show Me step 1 of 5: General' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    const spot = document.querySelector<HTMLElement>('[data-tour-spotlight]');
    expect(spot?.className).toContain('z-[calc(var(--z-modal)+1)]');
  });

  // The hole is the target grown by the padding, its corners rounded but never past half its height.
  it('cuts the spotlight hole round the padded target', () => {
    const path = holePath({ x: 6, y: 6, w: 128, h: 68 });
    expect(path).toMatch(/^path\(evenodd, '/);
    expect(path).toContain('M16 6H124');
    expect(holePath({ x: 0, y: 0, w: 100, h: 8 })).toContain('A4 4');
  });

  // Keyboard (docs/specs/007-editor/editor-tour.md): Escape is each card's way out, as its own button is.
  it('declines the offer, skips from a step and finishes from the last card on Escape', () => {
    const offer = engine({ id: 'welcome', card: 'welcome', title: 'Welcome', body: '' });
    const { unmount } = render(<TourStage engine={offer} />);
    // The offer asks nothing of the editor: Escape elsewhere is the editor's own.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(offer.skip).not.toHaveBeenCalled();
    const no = screen.getByRole('button', { name: 'No' });
    no.focus();
    fireEvent.keyDown(no, { key: 'Escape' });
    expect(offer.skip).toHaveBeenCalledOnce();
    unmount();
    const step = engine({ id: 'a', title: 'A', body: '' });
    const second = render(<TourStage engine={step} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(step.skip).toHaveBeenCalledOnce();
    second.unmount();
    const outro = engine({ id: 'outro', card: 'outro', title: 'Done', body: '' });
    render(<TourStage engine={outro} />);
    const inCard = screen.getByRole('dialog').querySelector('button')!;
    inCard.focus();
    fireEvent.keyDown(inCard, { key: 'Escape' });
    expect(outro.next).toHaveBeenCalledOnce();
    expect(outro.skip).not.toHaveBeenCalled();
  });

  it('leaves Escape to a field being edited, and to whatever already took it', () => {
    const e = engine({ id: 'a', title: 'A', body: '' });
    render(<TourStage engine={e} />);
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'Escape' });
    const taken = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    taken.preventDefault();
    document.dispatchEvent(taken);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(e.skip).not.toHaveBeenCalled();
    field.remove();
  });
});
