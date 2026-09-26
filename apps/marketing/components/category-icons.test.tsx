import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTION_IDS } from '@/lib/landing-content';
import { CATEGORY_ICONS } from './category-icons';

describe('CATEGORY_ICONS', () => {
  // A chip with no icon would fall out of line with its neighbours, and
  // nothing at runtime would notice.
  it('draws exactly one icon per feature category', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual([...LANDING_SECTION_IDS].sort());
  });

  it('gives every category its own drawing', () => {
    const drawings = Object.values(CATEGORY_ICONS).map((Icon) => renderToStaticMarkup(<Icon />));
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  it('renders decorative and in the text colour', () => {
    const Icon = CATEGORY_ICONS.simple!;
    const markup = renderToStaticMarkup(<Icon />);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('stroke="currentColor"');
  });
});
