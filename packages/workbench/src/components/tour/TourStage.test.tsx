// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourStepOf } from './tour-step';
import type { TourEngine } from './useTourEngine';
import { TourStage } from './TourStage';
import { holePath } from './TourSpotlight';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), with a second tour's own
// card words.

afterEach(cleanup);

// The tab's colours, as each editor's tourColourVars hands them in.
const COLOURS = { '--tour-accent': '#0369a1', '--tour-on-accent': '#ffffff' } as CSSProperties;

function engine(step: TourStepOf<unknown>, over: Partial<TourEngine<unknown>> = {}) {
  return {
    active: true,
    step,
    stepIndex: step.card === 'outro' ? 2 : 1,
    stepDir: 'forward',
    targetRect: null,
    yielded: false,
    landed: true,
    countableSteps: 2,
    start: vi.fn(),
    stop: vi.fn(),
    next: vi.fn(),
    back: vi.fn(),
    skip: vi.fn(),
    ...over,
  } as TourEngine<unknown>;
}

const stage = (e: TourEngine<unknown>, props: Partial<Parameters<typeof TourStage>[0]> = {}) => (
  <TourStage engine={e} colours={COLOURS} {...props} />
);

describe('TourStage', () => {
  it('draws nothing while the tour is not running', () => {
    const { container } = render(stage(engine({ id: 'a', title: 'A', body: '' }, { active: false })));
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('[data-tour-popover]')).toBeNull();
  });

  // docs/specs/007-editor/editor-tour.md "Dialogs come first".
  it('draws nothing while it has stepped aside for a dialog', () => {
    render(
      stage(
        engine(
          { id: 'a', title: 'A', body: '', target: 'a' },
          { yielded: true, targetRect: { left: 0, top: 0, width: 10, height: 10 } },
        ),
      ),
    );
    expect(document.querySelector('[data-tour-popover]')).toBeNull();
    expect(document.body.querySelector('[aria-hidden]')).toBeNull();
  });

  // docs/specs/007-editor/editor-tour.md "The last card": the step card, centred, never a banner.
  it('draws the last card in the step card, with the default words', () => {
    const e = engine({ id: 'outro', card: 'outro', title: "You're ready", body: '' });
    render(stage(e));
    expect(document.querySelector('[data-tour-banner]')).toBeNull();
    expect(document.querySelector('[data-tour-card="outro"]')).not.toBeNull();
    expect(screen.getByText('Tour complete')).toBeTruthy();
    // No ring and no dim behind it.
    expect(document.querySelector('[data-tour-spotlight]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(e.next).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(e.back).toHaveBeenCalled();
  });

  it("wears a second tour's own last-card words", () => {
    render(
      stage(engine({ id: 'outro', card: 'outro', title: 'Done', body: '' }), {
        copy: { outroEyebrow: 'Chart tour', finish: 'Done', helpHref: '/help/x/' },
      }),
    );
    expect(screen.getByText('Chart tour')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn More' }).getAttribute('href')).toBe('/help/x/');
  });

  it('rings the target and labels the step with the tour', () => {
    const e = engine(
      { id: 'one', title: 'One', body: 'Copy' },
      { targetRect: { left: 10, top: 10, width: 50, height: 20 } },
    );
    render(stage(e, { ariaPrefix: 'Chart tour' }));
    expect(screen.getByRole('dialog', { name: 'Chart tour step 2 of 2: One' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(e.back).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(e.skip).toHaveBeenCalled();
  });

  // docs/specs/007-editor/editor-tour.md "Look": the spotlight dims round the target; the card wears the tab's colours.
  it("spotlights the target and paints the card in the tab's accent", () => {
    const e = engine(
      { id: 'one', title: 'One', body: 'Copy' },
      { targetRect: { left: 10, top: 10, width: 50, height: 20 } },
    );
    render(stage(e, { ariaPrefix: 'Chart tour' }));
    expect(document.querySelector('[data-tour-spotlight]')).not.toBeNull();
    const card = document.querySelector<HTMLElement>('[data-tour-popover]')!;
    expect(card.style.getPropertyValue('--tour-accent')).toBe('#0369a1');
    expect(card.style.getPropertyValue('--tour-on-accent')).toBe('#ffffff');
  });

  // Every tour starts on its first step: "1 of N", with no Back.
  it('counts from the first step, spotlit over a dialog', () => {
    const e = engine(
      { id: 'general', title: 'General', body: 'Copy' },
      {
        stepIndex: 0,
        countableSteps: 5,
        targetRect: { left: 20, top: 20, width: 100, height: 40 },
      },
    );
    render(stage(e, { ariaPrefix: 'Show Me', layer: 'modal', pad: 14 }));
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
  it('skips from a step and finishes from the last card on Escape', () => {
    const step = engine({ id: 'a', title: 'A', body: '' });
    const first = render(stage(step));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(step.skip).toHaveBeenCalledOnce();
    first.unmount();
    const outro = engine({ id: 'outro', card: 'outro', title: 'Done', body: '' });
    render(stage(outro));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outro.next).toHaveBeenCalledOnce();
    expect(outro.skip).not.toHaveBeenCalled();
  });

  it('leaves Escape to a field being edited, and to whatever already took it', () => {
    const e = engine({ id: 'a', title: 'A', body: '' });
    render(stage(e));
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
