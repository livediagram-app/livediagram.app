import { describe, expect, it } from 'vitest';
import { POLL_OPTION_MAX } from '@livediagram/api-schema';
import { STICKY_PRESETS } from '@livediagram/document';
import {
  quizPhase,
  sessionButtonPlan,
  type Element,
  type ShapeElement,
} from '@livediagram/document';
import { buildTemplate } from './build-template';
import { templateCategory } from './template-categories';
import { templateEditorMode } from './template-modes';
import {
  BINGO_PROMPTS,
  ICEBREAKER_QUESTIONS,
  PUB_QUIZ_ROUNDS,
  PUB_QUIZ_SECONDS,
  TWO_TRUTHS_PLAYERS,
} from './template-quiz-games-data';
import type { TemplateKind } from './templates';

// docs/specs/012-collaboration/quiz-and-game-templates.md "Testing".
const GAMES: readonly TemplateKind[] = [
  'pub-quiz',
  'icebreaker-questions',
  'two-truths-and-a-lie',
  'would-you-rather',
  'people-bingo',
];

const shapes = (els: Element[], shape: string): ShapeElement[] =>
  els.filter((e): e is ShapeElement => e.type === 'shape' && e.shape === shape);

describe('quiz and game templates', () => {
  it.each(GAMES)('%s opens in Workshop, files under Quizzes & Games and builds', (kind) => {
    expect(templateEditorMode(kind)).toBe('workshop');
    expect(templateCategory(kind)).toBe('games');
    expect(buildTemplate(kind, 0, 0).length).toBeGreaterThan(5);
  });

  it('sets up every Pub Quiz card ready to run: four answers, a right one, the round length', () => {
    const quizzes = shapes(buildTemplate('pub-quiz', 0, 0), 'quiz');
    expect(quizzes).toHaveLength(9);
    for (const q of quizzes) {
      expect(quizPhase(q, Date.now()), q.label).toBe('ready');
      expect(q.quizOptions, q.label).toHaveLength(4);
      expect(q.quizCorrect, q.label).toBeGreaterThanOrEqual(0);
      expect(q.quizCorrect, q.label).toBeLessThan(4);
      expect(q.quizSeconds).toBe(PUB_QUIZ_SECONDS);
    }
    expect(new Set(quizzes.map((q) => q.label)).size).toBe(9);
  });

  it('hides the tie-breaker answer under a reveal zone, closed', () => {
    const els = buildTemplate('pub-quiz', 0, 0);
    const [cover] = shapes(els, 'reveal');
    const answer = els.find((e) => e.type === 'sticky')!;
    expect(cover).toBeDefined();
    expect(cover!.revealed).toBeFalsy();
    expect([cover!.x, cover!.y, cover!.width, cover!.height]).toEqual([
      answer.x,
      answer.y,
      answer.width,
      answer.height,
    ]);
    // The cover paints over the answer, so it comes after it.
    expect(els.indexOf(cover!)).toBeGreaterThan(els.indexOf(answer));
  });

  it.each(GAMES)('%s ships only session buttons that can start', (kind) => {
    for (const b of shapes(buildTemplate(kind, 0, 0), 'session-button')) {
      expect(sessionButtonPlan(b.session), JSON.stringify(b.session)).not.toBeNull();
    }
  });

  it('spins the icebreaker questions from a written list, each short enough for the Picker', () => {
    const pickers = shapes(buildTemplate('icebreaker-questions', 0, 0), 'picker');
    const written = pickers.find((p) => p.pickerSource === 'options');
    expect(written?.pickerOptions).toEqual(ICEBREAKER_QUESTIONS);
    for (const q of ICEBREAKER_QUESTIONS) expect(q.length, q).toBeLessThanOrEqual(80);
    expect(pickers.filter((p) => p.pickerSource !== 'options')).toHaveLength(1);
  });

  it('asks a poll per dilemma and per player', () => {
    const polls = (kind: TemplateKind) =>
      shapes(buildTemplate(kind, 0, 0), 'session-button').filter((b) => b.session?.tool === 'poll');
    expect(polls('would-you-rather')).toHaveLength(6);
    for (const p of polls('would-you-rather')) {
      // The wire's own limit, so a lower one is caught here rather than cut short on the server.
      for (const o of p.session!.options!) expect(o.length).toBeLessThanOrEqual(POLL_OPTION_MAX);
    }
    // One generic question each: the players' names are placeholders written over, and no Participant can rewrite
    // a poll's question.
    expect(polls('two-truths-and-a-lie').map((p) => p.session!.question)).toEqual([
      'Which one is the lie?',
      'Which one is the lie?',
      'Which one is the lie?',
    ]);
    expect(polls('two-truths-and-a-lie').map((p) => p.session!.options)).toEqual([
      ['1', '2', '3'],
      ['1', '2', '3'],
      ['1', '2', '3'],
    ]);
  });

  it('lays out sixteen distinct bingo prompts', () => {
    expect(new Set(BINGO_PROMPTS).size).toBe(16);
    const cells = shapes(buildTemplate('people-bingo', 0, 0), 'square');
    expect(cells.map((c) => c.label)).toEqual(BINGO_PROMPTS);
  });
});

describe('the Pub Quiz answers', () => {
  it('spreads the right answers over the letters, so picking one letter scores nothing special', () => {
    const correct = PUB_QUIZ_ROUNDS.flatMap((r) => r.questions.map((q) => q.correct));
    const share = (i: number) => correct.filter((c) => c === i).length;
    for (const i of [0, 1, 2, 3]) expect(share(i), `letter ${'ABCD'[i]}`).toBeLessThanOrEqual(3);
    // And no round answers one letter throughout.
    for (const r of PUB_QUIZ_ROUNDS)
      expect(new Set(r.questions.map((q) => q.correct)).size).toBeGreaterThan(1);
  });
});

describe('the players’ stickies', () => {
  it('each take a sticky preset’s paper and ink, so the colour picker names them', () => {
    for (const p of TWO_TRUTHS_PLAYERS)
      expect(
        STICKY_PRESETS.some((k) => k.fill === p.sticky.fillColor && k.text === p.sticky.textColor),
        p.name,
      ).toBe(true);
  });
});
