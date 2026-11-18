import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { contrastRatio } from './colors';
import { hexOklch } from './pen-colours';
import { LABEL_BACKDROP_CONTRAST } from './label-backdrop';
import {
  PAPER_INK_CACHE_SIZE,
  paperMarkBackdrops,
  withPaperLabelInks,
  withPaperMarkInks,
} from './paper-label-ink';
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

// docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen" (Work Tracker 748).
const part = (id: string, fillColor: string, extra: Record<string, unknown> = {}, x = 100) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x,
    y: 100,
    width: 80,
    height: 40,
    fillColor,
    ...extra,
  }) as unknown as Element;
const glyph = (id: string, strokeColor: unknown, x = 100) =>
  ({
    id,
    type: 'shape',
    shape: 'icon',
    iconId: 'home',
    x,
    y: 100,
    width: 24,
    height: 24,
    strokeColor,
  }) as unknown as Element;
const colours = (el: Element | undefined) =>
  el as unknown as { fillColor?: string; strokeColor?: string };

describe('withPaperMarkInks', () => {
  it('walks an ink fill on the paper to 3:1 on the slate, its matching stroke with it', () => {
    const els = [
      part('button', SLATE),
      part('arrow', SLATE, { strokeColor: SLATE }, 300),
      part('framed', SLATE, { strokeColor: '#cbd5e1' }, 500),
    ];
    const out = withPaperMarkInks(els, WHITE, els, SLATE);
    for (const el of out) {
      const ratio = contrastRatio(colours(el).fillColor!, SLATE);
      expect(ratio).toBeGreaterThanOrEqual(LABEL_BACKDROP_CONTRAST - 0.01);
      // The least walk: just past the floor, not white.
      expect(ratio).toBeLessThan(LABEL_BACKDROP_CONTRAST + 0.5);
    }
    expect(colours(out[1]).strokeColor).toBe(colours(out[1]).fillColor);
    expect(colours(out[2]).strokeColor).toBe('#cbd5e1');
  });

  it('draws a locked fill (a brand swatch) at its exact value on the dark paper', () => {
    // The Brand Board's Ink and Teal swatches: dark on the slate, but marked to stay as printed.
    const els = [
      part('ink', '#14213d', { themeLockFill: true, strokeColor: '#14213d' }),
      part('teal', '#0f4c5c', { themeLockFill: true }, 300),
      // An icon's stroke is not its fill: a locked fill leaves its stroke to the walk.
      { ...glyph('icon', '#0f172a', 500), themeLockFill: true } as Element,
    ];
    const out = withPaperMarkInks(els, WHITE, els, SLATE);
    expect(out[0]).toBe(els[0]);
    expect(out[1]).toBe(els[1]);
    expect(colours(out[2]).strokeColor).not.toBe('#0f172a');
  });

  it('walks an icon to the contrast it had on white, keeping a chosen glyph above a muted one', () => {
    const els = [glyph('chosen', '#0f172a'), glyph('muted', '#5f6f86', 300)];
    const out = withPaperMarkInks(els, WHITE, els, SLATE);
    const chosen = contrastRatio(colours(out[0]).strokeColor!, SLATE);
    const muted = contrastRatio(colours(out[1]).strokeColor!, SLATE);
    expect(muted).toBeGreaterThanOrEqual(contrastRatio('#5f6f86', WHITE) - 0.01);
    expect(chosen).toBeGreaterThan(muted);
  });

  it('changes nothing in the light editor, nor where no part sinks', () => {
    const els = [part('button', SLATE), part('soft', '#e2e8f0', {}, 300)];
    expect(withPaperMarkInks(els, WHITE, els, WHITE)).toBe(els);
    const light = [els[1]!];
    expect(withPaperMarkInks(light, WHITE, light, SLATE)).toBe(light);
  });

  it('leaves a part on a card, a translucent wash, a cycle, a word and an icon with no stroke colour', () => {
    const els = [
      part('card', '#ffffff', { width: 600, height: 400, x: 0, y: 0 }),
      part('on-card', SLATE, {}, 100),
      part('wash', SLATE, { opacity: 0.5 }, 700),
      part('cycle', SLATE, { shape: 'cycle' }, 900),
      label('word', SLATE, 1100),
      glyph('bare', undefined, 1300),
      glyph('named', 'ink', 1500),
    ];
    expect(withPaperMarkInks(els, WHITE, els, SLATE)).toBe(els);
  });

  it('leaves a part new since the stored list, or one that sat on a card as stored', () => {
    const now = [part('new', SLATE, {}, 300), part('moved', SLATE, {}, 900)];
    const stored = [
      part('card', '#f1f5f9', { width: 600, height: 400, x: 800, y: 0 }),
      part('moved', SLATE, {}, 900),
    ];
    expect(withPaperMarkInks(stored, WHITE, now, SLATE)).toBe(now);
  });

  it('leaves a part that read no better as stored (a pale fill a theme darkened)', () => {
    const stored = [part('p', '#eeeeee')];
    const now = [part('p', '#1e293b')];
    expect(withPaperMarkInks(stored, WHITE, now, SLATE)).toBe(now);
  });

  it('keeps every untouched element by identity', () => {
    const els = [part('soft', '#e2e8f0'), part('button', SLATE, {}, 300)];
    const out = withPaperMarkInks(els, WHITE, els, SLATE);
    expect(out[0]).toBe(els[0]);
    expect(out[1]).not.toBe(els[1]);
  });

  it('answers every mark’s backdrop when no ids are given', () => {
    const els = [
      part('card', '#ffffff', { width: 600, height: 400, x: 0, y: 0 }),
      glyph('g', SLATE),
    ];
    const found = paperMarkBackdrops(els, SLATE);
    expect(found.get('g')).toEqual({ colour: SLATE, behind: '#ffffff' });
    expect(found.get('card')).toEqual({ colour: '#ffffff', behind: SLATE });
  });

  it('walks a full board of sunk parts within budget', () => {
    const els: Element[] = [];
    for (let i = 0; i < 4000; i += 1)
      els.push(
        i % 2
          ? glyph(`g${i}`, SLATE, (i % 80) * 200)
          : part(`p${i}`, SLATE, { y: Math.floor(i / 80) * 60 }, (i % 80) * 200),
      );
    const ms = cpuMsOf(() => withPaperMarkInks(els, WHITE, els, SLATE));
    // Measured 55 to 78 ms cold here (the first call, JIT included) once the mark lookup shared the board's backdrop
    // grid (Work Tracker 896); the budget holds about twice that (it was 400).
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
