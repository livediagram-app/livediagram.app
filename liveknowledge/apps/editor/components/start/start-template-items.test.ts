import { describe, expect, it } from 'vitest';
import { templatePageKind } from '@liveknowledge/templates';
import {
  BLANK_KNOWLEDGEBASE,
  START_GROUP_ID,
  TEMPLATE_START,
  templateStartFor,
} from './start-template-items';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"
describe('the knowledgebase start', () => {
  const start = TEMPLATE_START;

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });

  it('leads with Start, Blank Knowledgebase alone, then the categories of writing templates', () => {
    expect(start.groups[0]).toMatchObject({ id: START_GROUP_ID, kinds: [BLANK_KNOWLEDGEBASE] });
    expect(start.groups.slice(1).map((g) => g.id)).toEqual([
      'engineering',
      'handbooks',
      'onboarding',
      'product',
      'support',
    ]);
    const kinds = start.groups.flatMap((g) => g.kinds);
    for (const kind of kinds) expect(templatePageKind(kind), kind).toBe('article');
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).not.toContain('blank-article');
  });

  it('finds Blank Knowledgebase and a template by their names', () => {
    expect(start.search('blank').flatMap((g) => g.kinds)).toContain(BLANK_KNOWLEDGEBASE);
    expect(start.search('meeting').flatMap((g) => g.kinds)).toContain('meeting-notes');
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
