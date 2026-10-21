import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/document';
import { PAGE_LAYOUTS } from '@liveplanner/templates';

// docs/specs/007-editor/pages-mode.md "Layouts": the Covers set's openers and front pages.
const IDS = [
  'report-cover',
  'magazine-cover',
  'book-cover',
  'proposal-cover',
  'case-study-cover',
  'newsletter-front',
  'contents',
  'certificate',
] as const;

const TALL = { x: 0, y: 0, width: 680, height: 980 };
const WIDE = { x: 0, y: 0, width: 980, height: 680 };
const SQUARE = { x: 0, y: 0, width: 930, height: 930 };

const layout = (id: string) => PAGE_LAYOUTS.find((l) => l.id === id)!;
const labels = (els: Element[]) =>
  els.map((e) => ('label' in e ? e.label : undefined)).filter((l): l is string => !!l);
const kinds = (els: Element[]) =>
  els.map((e) => (e.type === 'shape' ? e.shape : e.type)).filter(Boolean);
type Box = { x: number; y: number; width: number; height: number };
const xs = (els: Element[], label: string) =>
  els.find((e) => 'label' in e && e.label === label) as unknown as Box;

describe('the Covers set', () => {
  it('holds all twelve covers, the eight new ones among them', () => {
    const covers = PAGE_LAYOUTS.filter((l) => l.category === 'covers');
    expect(covers).toHaveLength(12);
    for (const id of IDS) expect(layout(id).category).toBe('covers');
  });

  it('labels each in Title Case, with a one-line description', () => {
    for (const id of IDS) {
      const { label, description } = layout(id);
      for (const word of label.split(' ')) expect(word[0]).toBe(word[0]!.toUpperCase());
      expect(description).not.toMatch(/\n/);
      expect(`${label}${description}`).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it('carries no colours of its own beyond a see-through fill', () => {
    for (const id of IDS) {
      for (const box of [TALL, WIDE, SQUARE]) {
        for (const el of layout(id).build(box)) {
          if ('fillColor' in el && el.fillColor !== undefined)
            expect(el.fillColor).toBe('transparent');
          if ('strokeColor' in el) expect(el.strokeColor).toBeUndefined();
          if ('textColor' in el) expect(el.textColor).toBeUndefined();
        }
      }
    }
  });

  it('sets the report year huge and its headline figures with their footnote', () => {
    const els = layout('report-cover').build(TALL);
    expect(labels(els)).toEqual(expect.arrayContaining(['2026', '£4.2m', '38', '12,400']));
    expect(labels(els).some((l) => l.startsWith('Figures for the year'))).toBe(true);
    expect(kinds(els)).toContain('image');
  });

  it('puts the year beside the title on a wide page, above it on a tall one', () => {
    const tall = layout('report-cover').build(TALL);
    const wide = layout('report-cover').build(WIDE);
    const title = 'Building a fairer energy future';
    expect(xs(tall, '2026').y).toBeLessThan(xs(tall, title).y);
    expect(xs(wide, '2026').x).toBeGreaterThan(xs(wide, title).x + xs(wide, title).width - 1);
  });

  it('gives the magazine a masthead, a picture and the cover story', () => {
    const els = layout('magazine-cover').build(TALL);
    expect(labels(els)).toEqual(
      expect.arrayContaining(['ORBIT', 'Cover story', 'The quiet revolution in how cities move']),
    );
    expect(kinds(els)).toContain('image');
  });

  it('frames the book and the certificate in a double rule', () => {
    for (const id of ['book-cover', 'certificate']) {
      const frames = layout(id)
        .build(TALL)
        .filter((e) => e.type === 'shape' && e.fillColor === 'transparent' && e.width > 300);
      expect(frames.length).toBeGreaterThanOrEqual(2);
    }
    const cert = layout('certificate').build(WIDE);
    expect(labels(cert)).toEqual(expect.arrayContaining(['Amara Okafor', 'Sam Patel', 'Date']));
    expect(cert.some((e) => e.type === 'shape' && e.shape === 'icon' && e.iconId === 'award')).toBe(
      true,
    );
  });

  it('lists all four proposal details, keeping two on a square page', () => {
    const tall = labels(layout('proposal-cover').build(TALL));
    for (const f of ['Prepared for', 'Prepared by', 'Date', 'Reference']) expect(tall).toContain(f);
    const square = labels(layout('proposal-cover').build(SQUARE));
    expect(square).toEqual(expect.arrayContaining(['Prepared for', 'Date']));
    expect(square).not.toContain('Reference');
  });

  it('ends the case study in three results and a source line', () => {
    const els = layout('case-study-cover').build(TALL);
    expect(labels(els)).toEqual(expect.arrayContaining(['89%', '3.4x', '£1.2m']));
    expect(labels(els).some((l) => l.startsWith('Results measured'))).toBe(true);
  });

  it('lists six chapters with their pages, dropping notes where rows are short (a square)', () => {
    const tall = labels(layout('contents').build(TALL));
    for (const n of ['01', '02', '03', '04', '05', '06', '03', '30']) expect(tall).toContain(n);
    expect(tall).toContain('A letter from our chair');
    const short = labels(layout('contents').build(SQUARE));
    expect(short).not.toContain('A letter from our chair');
  });

  it('runs the newsletter In this issue as a column on a wide page, two by two on a tall one', () => {
    const tall = layout('newsletter-front').build(TALL);
    const wide = layout('newsletter-front').build(WIDE);
    expect(xs(tall, '02').y).toBe(xs(tall, '03').y);
    expect(xs(wide, '02').x).toBe(xs(wide, '03').x);
  });
});
