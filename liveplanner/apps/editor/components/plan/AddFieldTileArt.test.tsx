// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { KindTileArt, PICTURED_KINDS } from './AddFieldTileArt';

describe('Add Field tile pictures', () => {
  it('draws the idea for the kinds a bare value would not explain', () => {
    expect(PICTURED_KINDS).toEqual(
      expect.arrayContaining([
        'calculated',
        'formula',
        'rollup',
        'lookup',
        'blocked-by',
        'checklist',
      ]),
    );
    for (const kind of PICTURED_KINDS) {
      const { container, unmount } = render(<KindTileArt kind={kind} />);
      expect(container.textContent?.length ?? 0, kind).toBeGreaterThanOrEqual(0);
      expect(container.firstChild, kind).not.toBeNull();
      unmount();
    }
  });

  it('works a Calculated field out from child cards, and a Formula from fields', () => {
    expect(render(<KindTileArt kind="calculated" />).container.textContent).toBe('2/3');
    expect(render(<KindTileArt kind="formula" />).container.textContent).toContain('Estimate');
    expect(render(<KindTileArt kind="rollup" />).container.textContent).toContain('Sum 10');
  });

  it('keeps the sample value for a kind that explains itself', () => {
    expect(PICTURED_KINDS).not.toContain('text');
    expect(render(<KindTileArt kind="text" />).container.textContent).toBe('Some text');
  });
});
