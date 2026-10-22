// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  QUIZ_DESIGN_SIZE,
  QUIZ_OPTION_HEIGHT,
  quizOptionCentres,
  quizOptionGrowth,
} from '@livediagram/document';
import { QuizOption } from './QuizOption';

// docs/specs/012-collaboration/quiz.md "Answers": an answer shows its whole text, growing away from the disc.
afterEach(cleanup);

const LONG =
  'Mercury is a very hot planet, the smallest one, and the closest to the sun of them all';
const c = QUIZ_DESIGN_SIZE / 2;

function answer(at: { x: number; y: number }, pickers?: React.ReactNode) {
  return render(
    <QuizOption
      index={0}
      text={LONG}
      at={at}
      state="open"
      mine={false}
      count={null}
      textColor="#1e3a5f"
      surface="#ffffff"
      pickers={pickers}
    />,
  );
}

describe('a Quiz answer', () => {
  it('shows its whole text, never cut to two lines', () => {
    answer({ x: c, y: 100 });
    const text = screen.getByText(LONG);
    expect(text.className).not.toMatch(/line-clamp/);
    // Its pill is at least the default size and grows with the text.
    const pill = screen.getByRole('button');
    expect(pill.style.minHeight).toBe(`${QUIZ_OPTION_HEIGHT}px`);
    expect(pill.style.height).toBe('');
  });

  it('grows away from the disc: up above it, down below it, both ways beside it', () => {
    const [top, right, bottom, left] = quizOptionCentres(4);
    expect([top, right, bottom, left].map((p) => quizOptionGrowth(p!))).toEqual([
      'up',
      'both',
      'down',
      'both',
    ]);
    // Above the disc the slot hangs from the pill's inner (bottom) edge.
    const { container } = answer(top!);
    const slot = container.firstElementChild as HTMLElement;
    expect(slot.style.top).toBe(`${top!.y + QUIZ_OPTION_HEIGHT / 2}px`);
    expect(slot.style.transform).toBe('translateY(-100%)');
  });

  it('puts who picked it on the outside, above an answer over the disc and below the rest', () => {
    const [top, , bottom] = quizOptionCentres(4);
    const above = answer(top!, <span>pickers</span>);
    expect(above.getByText('pickers').parentElement!.style.bottom).toBe('100%');
    cleanup();
    const below = answer(bottom!, <span>pickers</span>);
    expect(below.getByText('pickers').parentElement!.style.top).toBe('100%');
  });
});
