import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A <header> outside a <section>, <article>, <aside> or <nav> is a banner landmark, and the editor has one: its page
// header. A dialog's or popover's own <header> made a second banner whenever it opened (axe
// landmark-no-duplicate-banner and landmark-unique: Set Up Board over a dashboard, a comment thread's popover). Only
// these files may draw a <header>: the page's own, and those drawn inside a <section> of their own.
const ALLOWED = new Set([
  'chrome/EditorHeader.tsx',
  'chrome/AuthStage.tsx',
  'start/StartPanel.tsx',
  'plan/ItemTypeLayoutEditor.tsx',
]);

const root = fileURLToPath(new URL('.', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });
}

describe('banner landmarks', () => {
  it('draws a <header> only where it is the page header or scoped by a section', () => {
    const offenders = sources(root)
      .filter((p) => readFileSync(p, 'utf8').includes('<header'))
      .map((p) => relative(root, p))
      .filter((p) => !ALLOWED.has(p));
    expect(offenders).toEqual([]);
  });
});
