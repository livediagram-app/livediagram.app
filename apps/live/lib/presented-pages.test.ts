import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/document';
import { presentedPages } from './presented-pages';

// docs/specs/007-editor/illustrate-pages.md "Slides": a presenting page slide shows its page alone.
const tab = {
  id: 't',
  name: 'T',
  elements: [],
  pages: [
    { id: 'a', orientation: 'portrait' },
    { id: 'b', orientation: 'landscape' },
  ],
} as unknown as Tab;

describe('presentedPages', () => {
  it('passes the view through when no page slide presents', () => {
    expect(presentedPages(null, tab, null)).toBeNull();
  });

  it('builds the presented sheet from the tab outside Illustrate mode', () => {
    const view = presentedPages(null, tab, 'b')!;
    expect(view.pages.map((p) => p.id)).toEqual(['b']);
    expect(view.edit).toBeUndefined();
  });
});
