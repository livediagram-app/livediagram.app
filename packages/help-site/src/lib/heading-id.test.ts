import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { headingId } from './heading-id';

// Each app checks its own /help/…#anchor links against its articles' headings (its lib/heading-anchors.test.ts).
describe('heading ids', () => {
  it('slug a heading through any formatting inside it', () => {
    expect(headingId("When a Style Isn't Offered")).toBe('when-a-style-isn-t-offered');
    expect(headingId(['Using ', createElement('code', null, 'Cmd+K'), ' fast'])).toBe(
      'using-cmd-k-fast',
    );
  });
});
