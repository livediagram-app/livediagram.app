// A knowledgebase's screen says "page" for a tab (liveworkspace/docs/specs/018-automations/automations.md "Naming").
import { describe, expect, it } from 'vitest';
import { defineItemKinds } from '@liveworkspace/automations/item';
import { actionGroupsOf, itemValueGroups } from './rule-reads';
import {
  goneLabel,
  itemRefusalPicks,
  needWords,
  pickWords,
  runRefusalWords,
  sharedActionLines,
  sharedTriggerLines,
} from './words';

const KB = defineItemKinds({ itemWord: 'knowledgebase', collab: true, tabTemplates: true });

describe('a knowledgebase’s screen words', () => {
  it('say page wherever a document’s say tab', () => {
    expect(sharedTriggerLines('knowledgebase')['tab_added']).toBe(
      'A page is added to this knowledgebase.',
    );
    expect(sharedActionLines('knowledgebase')['add_tab']).toBe(
      'Add a page made from a template, named by the rule.',
    );
    expect(
      needWords(
        [
          { kind: 'tab', id: 'gone' },
          { kind: 'tab', id: '' },
        ],
        'knowledgebase',
      ),
    ).toBe('A page is gone · Pick a page');
    expect(pickWords('snapshot', 'knowledgebase')).toBe('Pick a snapshot');
    expect(pickWords('odd', 'knowledgebase')).toBe('Pick odd');
    expect(itemRefusalPicks('knowledgebase')['tabs']).toBe('a page');
    expect(goneLabel('tab', null, 'knowledgebase')).toBe('A page (No Longer Here)');
    expect(goneLabel('tab', 'Tab Etiquette', 'knowledgebase')).toBe(
      'Tab Etiquette (No Longer Here)',
    );
    expect(runRefusalWords('tab_not_found', '', 'knowledgebase')).toBe(
      'That page is no longer here. Pick another.',
    );
    const groups = actionGroupsOf(KB).map((g) => g.name);
    expect(groups.slice(0, 2)).toEqual(['Snapshots', 'Pages']);
    expect(
      itemValueGroups(KB, { trigger: { kind: 'tab_added' }, afterAi: false }).map((g) => g.label),
    ).toContain('Page');
  });

  it('leave a document’s as they were', () => {
    expect(needWords([{ kind: 'tab', id: 'gone' }])).toBe('A tab is gone');
    expect(goneLabel('tab')).toBe('A tab (No Longer Here)');
    expect(runRefusalWords('tab_not_found', '', 'document')).toBe(
      'That tab is no longer here. Pick another.',
    );
  });
});
