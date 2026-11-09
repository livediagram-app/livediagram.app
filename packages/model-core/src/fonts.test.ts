import { describe, expect, it } from 'vitest';
import { FONTS, fontIdsUsed, googleFontsHref, resolveFontStack } from './fonts';

// docs/specs/004-interface-design/fonts.md "Legible at every size": three faces that did not read at 12 px or at
// 50% zoom were swapped behind their ids. These pin the contract saved documents rely on.

const IDS = [
  'inter',
  'poppins',
  'nunito',
  'oswald',
  'space-grotesk',
  'lora',
  'abril-fatface',
  'roboto-slab',
  'roboto-mono',
  'caveat',
  'permanent-marker',
];

const firstFamily = (id: string) => resolveFontStack(id)?.split(',')[0]?.trim();

describe('the font catalogue keeps every stored id', () => {
  it('lists the same eleven ids in the same order, so saved text and agents keep working', () => {
    expect(FONTS.map((f) => f.id)).toEqual(IDS);
  });

  it('draws the three swapped ids in their legible faces', () => {
    expect(firstFamily('caveat')).toBe("'Kalam'");
    expect(firstFamily('permanent-marker')).toBe("'Shantell Sans'");
    expect(firstFamily('abril-fatface')).toBe("'Bodoni Moda'");
  });

  it('labels each face by the name it draws in', () => {
    for (const f of FONTS) expect(f.stack.startsWith(`'${f.label}'`)).toBe(true);
  });

  it('never names a retired face in a stack or a Google spec', () => {
    for (const f of FONTS) {
      for (const retired of ['Caveat', 'Permanent Marker', 'Permanent+Marker', 'Abril']) {
        expect(f.stack).not.toContain(retired);
        expect(f.google).not.toContain(retired);
      }
    }
  });

  it('keeps a stored legacy id in the export subset', () => {
    expect(
      fontIdsUsed([{ font: 'caveat' }, { font: 'permanent-marker' }], 'abril-fatface'),
    ).toEqual(['abril-fatface', 'caveat', 'permanent-marker']);
  });
});

describe('weights and fallbacks', () => {
  it('loads the marker and the display serif at one heavy weight, so a label never synthesises bold', () => {
    const google = (id: string) => FONTS.find((f) => f.id === id)!.google;
    expect(google('permanent-marker')).toBe('Shantell+Sans:wght@700');
    expect(google('abril-fatface')).toBe('Bodoni+Moda:opsz,wght@6..96,800');
  });

  it('gives the handwriting face a real bold', () => {
    expect(FONTS.find((f) => f.id === 'caveat')!.google).toBe('Kalam:wght@400;700');
  });

  it('falls the hand-lettered faces back to a readable system hand before the generic cursive', () => {
    for (const id of ['caveat', 'permanent-marker']) {
      const stack = resolveFontStack(id)!;
      expect(stack).toContain("'Chalkboard SE'");
      expect(stack.endsWith('cursive')).toBe(true);
      expect(stack).not.toContain('ui-sans-serif');
    }
  });

  it('asks Google for the new faces in a subset href', () => {
    const href = googleFontsHref(['caveat', 'permanent-marker', 'abril-fatface']);
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,800&family=Kalam:wght@400;700&family=Shantell+Sans:wght@700&display=swap',
    );
  });
});
