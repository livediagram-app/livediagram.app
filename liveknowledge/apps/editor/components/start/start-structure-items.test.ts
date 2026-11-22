import { describe, expect, it } from 'vitest';
import { SETUP_STRUCTURES } from '@liveknowledge/knowledge';
import {
  BLANK_KNOWLEDGEBASE,
  DESCRIBE_TO_SET_UP,
  START_GROUP_ID,
  knowledgebaseStart,
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
    expect(search('release process').flatMap((g) => g.ids)).toEqual(['engineering-handbook']);
    expect(search('zzzz')).toEqual([]);
  });
});
