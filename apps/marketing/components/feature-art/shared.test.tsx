import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Cursor } from './shared';

const DIR = fileURLToPath(new URL('.', import.meta.url));

describe('Cursor', () => {
  it('draws the arrow at its own scale, with no transform at the base size', () => {
    expect(renderToStaticMarkup(<Cursor color="#8b5cf6" />)).not.toContain('transform');
    expect(renderToStaticMarkup(<Cursor color="#8b5cf6" size={11.5} />)).toContain(
      'transform="scale(1.15)"',
    );
  });

  it('hangs the name tag below and right, or above and left when flipped', () => {
    const tag = (flip: boolean) =>
      renderToStaticMarkup(<Cursor color="#8b5cf6" name="Sam" flip={flip} />);
    expect(tag(false)).toContain('translate(7 10)');
    expect(tag(true)).toContain('translate(-20.6 -9)');
    expect(tag(true)).toContain('>Sam</text>');
  });

  it('leaves the tag out when nobody is named', () => {
    expect(renderToStaticMarkup(<Cursor color="#8b5cf6" />)).not.toContain('<rect');
  });
});

// The pointer is drawn once, here; the card families only place and scale it.
describe('one cursor drawing', () => {
  it('keeps the arrow path out of every other feature-art file', () => {
    const arrow = /d="M0 0 L0 \d|l0 11 l3 -2\.8/;
    const others = readdirSync(DIR).filter(
      (f) => /\.tsx$/.test(f) && f !== 'shared.tsx' && !f.endsWith('.test.tsx'),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const f of others) expect(readFileSync(`${DIR}${f}`, 'utf8'), f).not.toMatch(arrow);
  });
});
