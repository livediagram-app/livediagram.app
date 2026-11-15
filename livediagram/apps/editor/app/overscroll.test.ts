import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/specs/004-interface-design/touch-targets.md "The editor never pulls to refresh": the editor app's root turns
// off the browser's overscroll (pull-to-refresh) and the canvas takes every touch, while the marketing site and the
// help centre keep the browser's own.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const editorLayout = read('./layout.tsx');

describe('the editor root', () => {
  it('sets overscroll-none on <html> and <body>', () => {
    expect(editorLayout).toMatch(/<html\b[^>]*className="overscroll-none"/);
    expect(editorLayout).toMatch(/<body className="overscroll-none\b/);
  });

  it('leaves the marketing site and the help centre pulling to refresh', () => {
    for (const app of ['marketing', 'help']) {
      expect(read(`../../${app}/app/layout.tsx`)).not.toMatch(/overscroll-(none|contain)/);
    }
  });

  it('keeps the canvas taking every touch itself', () => {
    expect(read('../components/canvas/Canvas.tsx')).toMatch(
      /className=\{`relative flex-1 touch-none\b/,
    );
  });
});
