import { describe, expect, it } from 'vitest';
import { templatePageKind } from '@liveknowledge/templates';
import { TEMPLATE_START, templateStartFor } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_START;

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });
});

// docs/specs/007-editor/start-diagramming.md "Page type"
describe('the start by page type', () => {
  it('is the whole start under All Pages', () => {
    expect(templateStartFor('all')).toBe(TEMPLATE_START);
  });

  it('searches only within the page type', () => {
    const kinds = templateStartFor('slide')
      .search('article')
      .flatMap((g) => g.kinds);
    expect(kinds).not.toContain('article');
    for (const k of kinds) expect(templatePageKind(k), k).toBe('slide');
  });
});
