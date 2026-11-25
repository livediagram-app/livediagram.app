import { describe, expect, it } from 'vitest';
import {
  designFromPreview,
  isSavedDesignElement,
  savedDesignElement,
  savedDesignId,
  savedDesignOf,
  savedDesignPreview,
} from './saved';

// docs/specs/011-theme/page-designs.md "Saved designs".
describe('a saved design', () => {
  const tuned = {
    id: 'aurora' as const,
    scale: 1.4,
    colors: ['#112233', '#445566', '#778899'] as [string, string, string],
    flow: true as const,
  };

  it('is one element of its own kind, carrying the design with its tuning', () => {
    const el = savedDesignElement(tuned);
    expect(el.type).toBe('page-design');
    expect(isSavedDesignElement(el)).toBe(true);
    expect(savedDesignOf([el])).toMatchObject({ id: 'aurora', scale: 1.4, flow: true });
    // Anything else is not one saved design.
    expect(savedDesignOf([el, el])).toBeUndefined();
    expect(savedDesignOf([{ type: 'page-design', design: { id: 'nope' } }])).toBeUndefined();
    expect(isSavedDesignElement({ type: 'shape' })).toBe(false);
    expect(isSavedDesignElement(null)).toBe(false);
  });

  it('carries the design in its preview, read back as it was saved', () => {
    const preview = savedDesignPreview(tuned);
    expect(preview.startsWith('<svg')).toBe(true);
    expect(designFromPreview(preview)).toMatchObject({ id: 'aurora', scale: 1.4 });
    expect(designFromPreview(null)).toBeUndefined();
    expect(designFromPreview('<svg/>')).toBeUndefined();
    expect(designFromPreview('<svg><metadata>{not json</metadata></svg>')).toBeUndefined();
  });

  it('is named by agents as saved:<id>', () => {
    expect(savedDesignId('saved:abc')).toBe('abc');
    expect(savedDesignId({ id: 'saved:abc' })).toBe('abc');
    expect(savedDesignId('saved:')).toBeNull();
    expect(savedDesignId('aurora')).toBeNull();
    expect(savedDesignId(3)).toBeNull();
  });
});
