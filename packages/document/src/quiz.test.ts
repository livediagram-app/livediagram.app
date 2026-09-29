import { describe, expect, it } from 'vitest';
import {
  clampQuizSeconds,
  createShape,
  isQuizReady,
  quizCorrectKeys,
  quizLockAt,
  quizOptionAngle,
  quizPhase,
  quizRemainingMs,
  quizResetPatch,
  quizStartPatch,
  quizTally,
  isValidElement,
  type QuizFields,
} from './index';

const base: QuizFields = {
  label: 'Q',
  quizOptions: ['A', 'B', 'C'],
  quizCorrect: 1,
  quizSeconds: 20,
};

describe('quiz (docs/specs/012-collaboration/quiz.md)', () => {
  it('is setup until two answers have text and the right one is valid', () => {
    expect(quizPhase({ ...base, quizOptions: ['A'] }, 0)).toBe('setup');
    expect(quizPhase({ ...base, quizOptions: ['A', '  '] }, 0)).toBe('setup');
    expect(quizPhase({ ...base, quizCorrect: undefined }, 0)).toBe('setup');
    expect(quizPhase({ ...base, quizCorrect: 3 }, 0)).toBe('setup');
    expect(quizPhase({ ...base, quizOptions: ['A', '', 'C'], quizCorrect: 1 }, 0)).toBe('setup');
    expect(isQuizReady(base)).toBe(true);
    expect(quizPhase(base, 0)).toBe('ready');
  });

  it('opens on start and locks when the time is up', () => {
    const started = { ...base, quizStartedAt: 1000 };
    expect(quizLockAt(started)).toBe(21_000);
    expect(quizPhase(started, 20_999)).toBe('open');
    expect(quizRemainingMs(started, 11_000)).toBe(10_000);
    expect(quizPhase(started, 21_000)).toBe('locked');
    expect(quizRemainingMs(started, 30_000)).toBe(0);
  });

  it('locks early on Lock now, and reveal wins over everything', () => {
    const early = { ...base, quizStartedAt: 1000, quizLockedAt: 5000 };
    expect(quizPhase(early, 4999)).toBe('open');
    expect(quizPhase(early, 5000)).toBe('locked');
    expect(quizPhase({ ...early, quizRevealed: true }, 0)).toBe('revealed');
  });

  it('clamps the seconds where read', () => {
    expect(clampQuizSeconds(undefined)).toBe(20);
    expect(clampQuizSeconds(1)).toBe(5);
    expect(clampQuizSeconds(10_000)).toBe(300);
    expect(clampQuizSeconds(Number.NaN)).toBe(20);
  });

  it('tallies picks by answer and names who was right, in answer order', () => {
    const q: QuizFields = {
      ...base,
      responses: [
        { participantId: 'p1', value: '1', at: 1 },
        { participantId: 'p2', value: '0', at: 2 },
        { participantId: 'p3', value: '1', at: 3 },
        // A pick against an answer since edited away counts nowhere.
        { participantId: 'p4', value: '7', at: 4 },
      ],
    };
    expect(quizTally(q)).toEqual([1, 2, 0]);
    expect(quizCorrectKeys(q)).toEqual(['p1', 'p3']);
  });

  it('start and reset both open a new round with no picks', () => {
    expect(quizStartPatch(5, 'r1')).toMatchObject({
      quizStartedAt: 5,
      quizRevealed: false,
      responses: [],
      collabRound: 'r1',
    });
    const reset = quizResetPatch('r2');
    expect(reset.quizStartedAt).toBeUndefined();
    expect(reset.collabRound).toBe('r2');
  });

  it('puts answer A at 12 o clock and spaces the rest evenly', () => {
    expect(quizOptionAngle(0, 4)).toBe(0);
    expect(quizOptionAngle(1, 4)).toBeCloseTo(Math.PI / 2);
    expect(quizOptionAngle(2, 4)).toBeCloseTo(Math.PI);
  });

  it('arrives as a ready, valid question with its aspect locked', () => {
    const el = createShape('quiz', 0, 0);
    expect(el.type === 'shape' && el.aspectLocked).toBe(true);
    expect(quizPhase(el as QuizFields, 0)).toBe('ready');
    expect(isValidElement(el)).toBe(true);
  });

  it('rejects malformed quiz fields', () => {
    const el = createShape('quiz', 0, 0);
    expect(isValidElement({ ...el, quizOptions: 'nope' })).toBe(false);
    expect(isValidElement({ ...el, quizOptions: ['x'.repeat(81)] })).toBe(false);
    expect(isValidElement({ ...el, quizOptions: Array(7).fill('a') })).toBe(false);
    expect(isValidElement({ ...el, quizStartedAt: 'soon' })).toBe(false);
    expect(isValidElement({ ...el, quizRevealed: 1 })).toBe(false);
  });
});

describe('quiz layout', () => {
  it('keeps every answer inside the square and clear of the disc', async () => {
    const {
      quizOptionCentres,
      QUIZ_DESIGN_SIZE,
      QUIZ_DISC_RADIUS,
      QUIZ_OPTION_WIDTH,
      QUIZ_OPTION_HEIGHT,
    } = await import('./quiz');
    for (let n = 2; n <= 6; n++) {
      for (const p of quizOptionCentres(n)) {
        const left = p.x - QUIZ_OPTION_WIDTH / 2;
        const top = p.y - QUIZ_OPTION_HEIGHT / 2;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(left + QUIZ_OPTION_WIDTH).toBeLessThanOrEqual(QUIZ_DESIGN_SIZE);
        expect(top + QUIZ_OPTION_HEIGHT).toBeLessThanOrEqual(QUIZ_DESIGN_SIZE);
        // The nearest point of the pill's box to the centre is outside the disc.
        const c = QUIZ_DESIGN_SIZE / 2;
        const nx = Math.max(left, Math.min(c, left + QUIZ_OPTION_WIDTH));
        const ny = Math.max(top, Math.min(c, top + QUIZ_OPTION_HEIGHT));
        expect(Math.hypot(nx - c, ny - c)).toBeGreaterThan(QUIZ_DISC_RADIUS);
      }
    }
  });
});

describe('compactQuizOptions', () => {
  it('drops blank rows and keeps the right answer pointing at its row', async () => {
    const { compactQuizOptions } = await import('./quiz');
    expect(compactQuizOptions(['A', '', ' C ', 'D'], 2)).toEqual({
      options: ['A', 'C', 'D'],
      correct: 1,
    });
    expect(compactQuizOptions(['A', ''], 0)).toBeNull();
    expect(compactQuizOptions(['A', '', 'C'], 1)).toBeNull();
  });
});

describe('quiz label editing', () => {
  it('never opens the inline label editor (the Edit Quiz dialog owns the question)', async () => {
    const { opensInlineLabelEditor } = await import('./index');
    expect(opensInlineLabelEditor('quiz')).toBe(false);
    expect(opensInlineLabelEditor('square')).toBe(true);
    expect(opensInlineLabelEditor('pie-chart')).toBe(false);
  });
});

describe('quizPickerKeys', () => {
  it('groups who picked what by answer, in answer order', async () => {
    const { quizPickerKeys } = await import('./quiz');
    expect(
      quizPickerKeys({
        quizOptions: ['A', 'B'],
        responses: [
          { participantId: 'p1', value: '1', at: 1 },
          { participantId: 'p2', value: '0', at: 2 },
          { participantId: 'p3', value: '1', at: 3 },
          { participantId: 'p4', value: '9', at: 4 },
        ],
      }),
    ).toEqual([['p2'], ['p1', 'p3']]);
  });
});
