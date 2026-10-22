import { describe, expect, it } from 'vitest';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { presentedPages } from './presented-pages';

// docs/specs/007-editor/pages-mode.md "Slides": a presenting page slide shows its page alone.
const view = {
  pages: [
    { id: 'a', orientation: 'portrait' },
    { id: 'c', orientation: 'portrait', kind: 'logo' },
  ],
} as unknown as PagesModeView;

describe('presentedPages', () => {
  it('passes the view through when no page slide presents', () => {
    expect(presentedPages(view, null)).toBe(view);
  });

  it('narrows the view to the presented page', () => {
    const shown = presentedPages(view, 'c');
    expect(shown.pages.map((p) => p.id)).toEqual(['c']);
    expect(shown.rowPages?.map((p) => p.id)).toEqual(['a', 'c']);
    // The surround is blacked out round the presented sheet.
    expect(shown.letterbox).toBe(true);
  });
});
