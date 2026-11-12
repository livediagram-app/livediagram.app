import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { contrastRatio } from './colors';
import { hexOklch } from './pen-colours';
import { LABEL_BACKDROP_CONTRAST } from './label-backdrop';
import { PAPER_INK_CACHE_SIZE, withPaperLabelInks } from './paper-label-ink';
import type { Element } from './index';

// docs/specs/011-theme/light-and-dark.md "Words on the plain paper keep the contrast they were made with";
// blueprint docs/specs/011-theme/blueprints/paper-label-ink.md.

const WHITE = '#ffffff';
const SLATE = '#0f172a';

const panel = (id: string, fillColor: string) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    fillColor,
  }) as unknown as Element;
const label = (id: string, textColor: string | undefined, x = 100, y = 100) =>
  ({
    id,
    type: 'text',
    x,
    y,
    width: 120,
    height: 24,
    label: 'Words',
    ...(textColor ? { textColor } : {}),
  }) as unknown as Element;
const ink = (el: Element | undefined) => (el as { textColor?: string } | undefined)?.textColor;

describe('withPaperLabelInks', () => {
  it('walks ink, body and muted greys to the contrast each had on white, keeping their steps', () => {
    const els = [
      label('ink', '#0f172a'),
      label('body', '#334155', 300),
      label('muted', '#5f6f86', 500),
    ];
    const out = withPaperLabelInks(els, WHITE, els, SLATE);
    const ratios = out.map((el) => contrastRatio(ink(el)!, SLATE));
    for (const r of ratios) expect(r).toBeGreaterThanOrEqual(4.5);
    // Three steps still: ink reads most, then body, then muted.
    expect(ratios[0]!).toBeGreaterThan(ratios[1]!);
    expect(ratios[1]!).toBeGreaterThan(ratios[2]!);
    // Each reaches what it had on white (ink's slate tops out at white).
    expect(ratios[1]!).toBeGreaterThanOrEqual(contrastRatio('#334155', WHITE) - 0.01);
    expect(ratios[2]!).toBeGreaterThanOrEqual(contrastRatio('#5f6f86', WHITE) - 0.01);
  });

  it('keeps the hue of a coloured word (a brand wordmark)', () => {
    const els = [label('word', '#3b1f14')];
    const walked = ink(withPaperLabelInks(els, WHITE, els, SLATE)[0])!;
    expect(contrastRatio(walked, SLATE)).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(hexOklch(walked)!.h - hexOklch('#3b1f14')!.h)).toBeLessThan(8);
  });

  it('changes nothing in the light editor, where the paper is drawn as stored', () => {
    const els = [label('t', '#0f172a')];
    expect(withPaperLabelInks(els, WHITE, els, WHITE)).toBe(els);
  });

  it('answers the same array when there is no label', () => {
    const els = [panel('p', '#ffffff')];
    expect(withPaperLabelInks(els, WHITE, els, SLATE)).toBe(els);
  });

  it('leaves a word on a card to the card', () => {
    const els = [panel('card', '#ffffff'), label('t', '#0f172a')];
    expect(withPaperLabelInks(els, WHITE, els, SLATE)).toBe(els);
  });

  it('leaves a word that sat on a card as stored', () => {
    const before = [panel('card', '#f1f5f9'), label('t', '#0f172a')];
    const after = [label('t', '#0f172a')];
    expect(withPaperLabelInks(before, WHITE, after, SLATE)).toBe(after);
  });

  it('leaves a word new since the stored list alone', () => {
    const after = [label('new', '#0f172a')];
    expect(withPaperLabelInks([], WHITE, after, SLATE)).toBe(after);
  });

  it('leaves light words that read better on the dark paper', () => {
    const els = [label('t', '#e2e8f0')];
    expect(withPaperLabelInks(els, WHITE, els, SLATE)).toBe(els);
  });

  it('lifts a word made under 3:1 on white to the shared floor', () => {
    const els = [label('t', '#cbd5e1')];
    // #cbd5e1 is 1.5:1 on white and 12:1 on slate: it reads better, so it is kept.
    expect(withPaperLabelInks(els, WHITE, els, SLATE)).toBe(els);
    // A mid grey made at 2.5:1 on white, drawn on a mid paper it sinks into, reaches 3:1.
    const mid = [label('m', '#9aa3ae')];
    const out = withPaperLabelInks(mid, WHITE, mid, '#7b8794');
    expect(contrastRatio(ink(out[0])!, '#7b8794')).toBeGreaterThanOrEqual(LABEL_BACKDROP_CONTRAST);
  });

  it('keeps every untouched element by identity', () => {
    const els = [
      panel('card', '#ffffff'),
      label('on-card', '#0f172a'),
      label('paper', '#0f172a', 600),
    ];
    const out = withPaperLabelInks(els, WHITE, els, SLATE);
    expect(out[0]).toBe(els[0]);
    expect(out[1]).toBe(els[1]);
    expect(out[2]).not.toBe(els[2]);
  });

  it('walks a full board of paper labels within budget, past the cache size', () => {
    const els: Element[] = [];
    for (let i = 0; i < 4000; i += 1) {
      // More dark inks than the cache holds, so it fills and is cleared on the way.
      const r = (0x10 + (i % 40)).toString(16);
      const g = (0x10 + (Math.floor(i / 40) % 40)).toString(16);
      els.push(label(`t${i}`, `#${r}${g}2a`, (i % 80) * 200, Math.floor(i / 80) * 60));
    }
    expect(1600).toBeGreaterThan(PAPER_INK_CACHE_SIZE);
    const ms = cpuMsOf(() => withPaperLabelInks(els, WHITE, els, SLATE));
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
