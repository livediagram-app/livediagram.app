import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createShape, createText } from '@livediagram/document';
import {
  TEXT_ANIM_MAX_LETTERS,
  TEXT_ANIM_MAX_WORDS,
  flickerPhase,
  planTextAnimation,
  renderUnits,
  scrambleGlyph,
  unitCount,
} from './animated-words';
import { textAnimationView } from './useTextAnimation';

const html = (text: string, anim: Parameters<typeof planTextAnimation>[1]) => {
  const plan = planTextAnimation([text], anim, 'el1');
  return renderToStaticMarkup(<>{renderUnits(text, plan, { next: 0 })}</>);
};
const units = (markup: string) => (markup.match(/class="lvd-tx-unit"/g) ?? []).length;
// The visible text of rendered markup: everything outside the tags. Split
// rather than replace, so it reads as text extraction, not sanitising.
const textOf = (markup: string) => markup.split(/<[^>]*>/).join('');

describe('planTextAnimation (granularity)', () => {
  it('splits letter animations into letters, ignoring spaces', () => {
    expect(planTextAnimation(['Hi there'], 'typewriter', 'x')).toMatchObject({
      mode: 'letters',
      count: 7,
    });
  });

  it('splits Words into words and block animations into one block', () => {
    expect(planTextAnimation(['one two three'], 'words', 'x')).toMatchObject({
      mode: 'words',
      count: 3,
    });
    expect(planTextAnimation(['one two three'], 'highlighter', 'x')).toMatchObject({
      mode: 'block',
      count: 1,
    });
  });

  it('falls back to words past the letter limit, Scramble becoming Typewriter', () => {
    const long = 'abcd '.repeat(TEXT_ANIM_MAX_LETTERS / 4 + 1);
    expect(planTextAnimation([long], 'wave', 'x')).toMatchObject({ mode: 'words' });
    expect(planTextAnimation([long], 'scramble', 'x')).toMatchObject({
      mode: 'words',
      animation: 'typewriter',
    });
  });

  it('falls back to one block past the word limit: reveals as Focus, loops as Glow', () => {
    // Past the letter limit first (words), then past the word limit (one block).
    const long = 'word '.repeat(TEXT_ANIM_MAX_WORDS + 1);
    expect(planTextAnimation([long], 'typewriter', 'x')).toMatchObject({
      mode: 'block',
      animation: 'focus',
    });
    expect(planTextAnimation([long], 'rainbow', 'x')).toMatchObject({
      mode: 'block',
      animation: 'glow',
    });
  });

  it('counts across every run of a rich label', () => {
    expect(planTextAnimation(['ab', ' cd'], 'cascade', 'x').count).toBe(4);
  });
});

describe('renderUnits', () => {
  it('numbers letters across runs with a shared counter', () => {
    const plan = planTextAnimation(['ab', 'cd'], 'cascade', 'x');
    const counter = { next: 0 };
    const a = renderToStaticMarkup(<>{renderUnits('ab', plan, counter)}</>);
    const b = renderToStaticMarkup(<>{renderUnits('cd', plan, counter, '1:')}</>);
    expect(a).toContain('--i:0');
    expect(b).toContain('--i:2');
    expect(b).toContain('--i:3');
    expect(b).toContain('data-last');
  });

  it('keeps every unit aria-hidden and the words themselves in the text', () => {
    const markup = html('Hello world', 'typewriter');
    expect(units(markup)).toBe(10);
    expect(textOf(markup)).toBe('Hello world');
    // Letters sit in their word's group, which is the aria-hidden node.
    expect(markup.match(/class="lvd-tx-word" aria-hidden="true"/g)).toHaveLength(2);
    const words = html('Hello world', 'words');
    expect(words.match(/class="lvd-tx-unit"[^>]*aria-hidden="true"/g)).toHaveLength(2);
  });

  it('keeps each word together so it never breaks mid-animation', () => {
    expect(html('ab cd', 'wave').match(/lvd-tx-word/g)).toHaveLength(2);
  });

  it('agrees with unitCount on where each text ends', () => {
    for (const anim of ['typewriter', 'words', 'focus'] as const) {
      const plan = planTextAnimation(['one two', 'three'], anim, 'x');
      const counter = { next: 0 };
      renderUnits('one two', plan, counter);
      expect(counter.next).toBe(plan.mode === 'block' ? 1 : unitCount('one two', plan));
    }
  });
});

describe('determinism', () => {
  it('draws the same stand-ins and flickers for the same element', () => {
    expect(scrambleGlyph('el1', 3, 0)).toBe(scrambleGlyph('el1', 3, 0));
    expect(html('Scramble me', 'scramble')).toBe(html('Scramble me', 'scramble'));
    const flicks = Array.from({ length: 60 }, (_, i) => flickerPhase('el1', i));
    expect(flicks).toEqual(Array.from({ length: 60 }, (_, i) => flickerPhase('el1', i)));
  });

  it('flickers a few letters, never none', () => {
    const flicks = Array.from({ length: 100 }, (_, i) => flickerPhase('el1', i));
    const n = flicks.filter((f) => f !== undefined).length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(30);
  });

  it('puts stand-ins only in data attributes, never in the text', () => {
    const markup = html('Ab', 'scramble');
    expect(markup).toMatch(/data-a="."/);
    expect(textOf(markup)).toBe('Ab');
  });
});

describe('textAnimationView', () => {
  it('is undefined without a Text animation, while editing, or with no words', () => {
    const text = { ...createText(0, 0), textAnimation: 'wave' as const };
    expect(textAnimationView(createText(0, 0), ['hi'], '#000', false)).toBeUndefined();
    expect(textAnimationView(text, ['hi'], '#000', true)).toBeUndefined();
    expect(textAnimationView(text, ['  '], '#000', false)).toBeUndefined();
  });

  it('carries the class, the play-once marker, the accent and the accessible name', () => {
    // Repeat unset: Text plays once by default.
    const shape = {
      ...createShape('square', 0, 0),
      textAnimation: 'typewriter' as const,
      strokeColor: '#ff0000',
    };
    const view = textAnimationView(shape, ['Hello'], '#111', false)!;
    expect(view.className).toBe('lvd-tx lvd-tx-typewriter lvd-once');
    expect(view.style).toMatchObject({ '--lvd-text-iter': 1 });
    const looping = textAnimationView(
      { ...shape, textAnimationRepeat: true },
      ['Hello'],
      '#111',
      false,
    )!;
    expect(looping.className).toBe('lvd-tx lvd-tx-typewriter');
    expect('--lvd-text-iter' in looping.style).toBe(false);
    expect(view.ariaLabel).toBe('Hello');
    expect(view.style).toMatchObject({ '--lvd-text-n': 5, '--lvd-anim-color': '#ff0000' });
  });

  it('ignores an unknown stored value', () => {
    const text = { ...createText(0, 0), textAnimation: 'nope' as never };
    expect(textAnimationView(text, ['hi'], '#000', false)).toBeUndefined();
  });
});

describe('performance', () => {
  it('splits a label at the letter limit well within budget', () => {
    const text = 'The quick brown fox jumps. '.repeat(Math.ceil(TEXT_ANIM_MAX_LETTERS / 22));
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      const plan = planTextAnimation([text], 'scramble', 'el1');
      renderUnits(text, plan, { next: 0 });
    }
    // Ten splits; the budget is 5 ms each, generous for a loaded CI machine.
    expect((performance.now() - start) / 10).toBeLessThan(5);
  });
});
