// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { describeFormHeroArt, describePlanHeroArt } from '@/components/describe/DescribeHeroArt';
import { syncGateHeroArt } from '@/components/dialogs/SyncGateHeroArt';
import { practiceSheetHeroArt } from '@/components/tour/PracticeSheetHeroArt';
import { addFieldHeroArt } from './AddFieldHeroArt';
import { cardPickerHeroArt } from './CardPickerHeroArt';
import { itemTypeEditorHeroArt } from './ItemTypeEditorHeroArt';
import { repeatHeroArt } from './RepeatHeroArt';
import { requiredFieldsHeroArt } from './RequiredFieldsHeroArt';

// liveworkspace/docs/specs/004-index/dialog-hero-header.md "Art": the Plan dialogs' own art, each beside its dialog,
// held to the rules the shared folder's art is held to.
const COMPONENTS = join(import.meta.dirname, '..');
const arts: { file: string; art: HeroArt }[] = [
  { file: 'plan/AddFieldHeroArt.tsx', art: addFieldHeroArt },
  { file: 'plan/CardPickerHeroArt.tsx', art: cardPickerHeroArt },
  { file: 'plan/ItemTypeEditorHeroArt.tsx', art: itemTypeEditorHeroArt },
  { file: 'plan/RepeatHeroArt.tsx', art: repeatHeroArt },
  { file: 'plan/RequiredFieldsHeroArt.tsx', art: requiredFieldsHeroArt },
  { file: 'describe/DescribeHeroArt.tsx', art: describePlanHeroArt },
  { file: 'describe/DescribeHeroArt.tsx', art: describeFormHeroArt },
  { file: 'dialogs/SyncGateHeroArt.tsx', art: syncGateHeroArt },
  { file: 'tour/PracticeSheetHeroArt.tsx', art: practiceSheetHeroArt },
];

describe.each(arts.map((a) => ({ ...a, name: a.art.name })))('$name', ({ file, art }) => {
  it('paints only in the tokens, fetches nothing and uses no filter', () => {
    const source = readFileSync(join(COMPONENTS, file), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)\(/);
    expect(source).not.toMatch(/<image\b|<img\b|url\(|href=/);
    expect(source).not.toMatch(/\bfilter\b|blur\(|drop-shadow/);
  });

  it('draws a texture and one corner piece, at most 96 x 30, shown from `sm`, and no centre piece', () => {
    const { container } = render(<HeroBand art={art} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe(art.name);
    expect(band.style.backgroundImage).toContain('gradient');
    const pieces = [...band.children];
    expect(pieces).toHaveLength(1);
    const piece = pieces[0]!;
    expect(piece.tagName.toLowerCase()).toBe('svg');
    expect(piece.getAttribute('aria-hidden')).toBe('true');
    expect(String(piece.getAttribute('class'))).toContain('max-sm:hidden');
    expect(Number(piece.getAttribute('width'))).toBeLessThanOrEqual(96);
    expect(Number(piece.getAttribute('height'))).toBeLessThanOrEqual(30);
    expect(art.centre).toBeFalsy();
  });

  it('moves at most once, twice over and only where motion is welcome', () => {
    const { container } = render(<HeroBand art={art} />);
    const moving = [...container.querySelectorAll('[class*="animate-"]')];
    expect(moving.length).toBeLessThanOrEqual(1);
    for (const el of moving) {
      const cls = String(el.getAttribute('class'));
      expect(cls).toMatch(/motion-safe:animate-/);
      expect(cls).toContain('[animation-iteration-count:2]!');
    }
  });

  it('marks the title with a glyph of its own', () => {
    const { container } = render(<HeroTitleMark art={art} />);
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('data-dialog-hero-mark')).toBe(art.name);
    expect(mark.querySelector('svg')!.childElementCount).toBeGreaterThan(0);
  });
});

it('gives every art a name of its own', () => {
  expect(new Set(arts.map((a) => a.art.name)).size).toBe(arts.length);
});
