import { describe, expect, it } from 'vitest';
import { SETUP_STRUCTURES, setupStructure } from '@liveknowledge/knowledge';
import {
  BLANK_KNOWLEDGEBASE,
  DESCRIBE_TO_SET_UP,
  START_GROUP_ID,
  knowledgebaseStart,
  structureOutline,
  structurePageCount,
} from './start-structure-items';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"
describe('the knowledgebase start', () => {
  it('leads with Start, then every structure once under its group', () => {
    const start = knowledgebaseStart({ describe: true });
    expect(start.groups[0]).toMatchObject({
      id: START_GROUP_ID,
      ids: [BLANK_KNOWLEDGEBASE, DESCRIBE_TO_SET_UP],
    });
    const structures = start.groups.slice(1).flatMap((g) => g.ids);
    expect(structures.sort()).toEqual(SETUP_STRUCTURES.map((s) => s.id).sort());
    expect(knowledgebaseStart({ describe: false }).groups[0]!.ids).toEqual([BLANK_KNOWLEDGEBASE]);
  });

  it('searches names, lines and page titles, every word', () => {
    const { search } = knowledgebaseStart({ describe: true });
    expect(search('blank')).toEqual([{ group: 'start', ids: ['blank'] }]);
    expect(search('describe ai')).toEqual([{ group: 'start', ids: ['describe'] }]);
    expect(search('release process').flatMap((g) => g.ids)).toEqual(['engineering-wiki']);
    expect(search('zzzz')).toEqual([]);
  });
});

describe('a structure outline', () => {
  const wiki = setupStructure('engineering-wiki')!;

  it('lists each top page with its subpages, and counts every page', () => {
    const { lines, more } = structureOutline(wiki);
    expect(lines.map((l) => l.title)).toEqual([
      'Overview',
      'Architecture',
      'Development',
      'Shipping',
    ]);
    expect(lines[3]!.under).toEqual(['Release Process', 'On-Call']);
    expect(more).toBe(0);
    expect(structurePageCount(wiki)).toBe(13);
  });

  it('gives its last line to a count of the top pages past it', () => {
    expect(structureOutline(wiki, 4).more).toBe(0);
    const { lines, more } = structureOutline(wiki, 3);
    expect(lines.map((l) => l.title)).toEqual(['Overview', 'Architecture']);
    expect(more).toBe(2);
  });
});
