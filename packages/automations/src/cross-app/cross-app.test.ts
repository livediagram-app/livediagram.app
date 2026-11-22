import { CROSS_APP_HOPS_MAX, CROSS_APP_STEPS_MAX } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { defineItemKinds, itemRuleSentence, readItemRule, type ItemNames } from '../item';
import {
  CROSS_APP_GROUP,
  crossAppActions,
  crossAppChip,
  CROSS_APP_READERS,
  readTarget,
  recipientsWords,
} from './kinds';
import { chainOf, chainStop, nextChain, readChain } from './chain';
import {
  appWord,
  CROSS_APP_AUTHOR_CAPPED,
  CROSS_APP_CHAIN_LONG,
  CROSS_APP_LOOP,
  CROSS_APP_UNREACHED,
  noAccessWords,
  isAccessPause,
  CROSS_APP_NO_AUTHOR,
  refusalWords,
  targetWords,
} from './words';

const KINDS = defineItemKinds({ itemWord: 'knowledgebase', collab: false, tabTemplates: true });
const names: ItemNames = {
  itemWord: 'knowledgebase',
  people: new Map([['ana', 'Ana Costa']]),
};
const plan = { app: 'liveplanner', item: 'p1', title: 'Release Plan' };
const kb = { app: 'liveknowledge', item: 'k1', title: 'Docs' };
const space = { app: 'livehuddle', item: 's1', title: 'Office' };
const doc = { app: 'livedocuments', item: 'd1', title: 'Brief' };

const rule = (steps: unknown[]) => ({
  name: 'Cross',
  timeZone: 'UTC',
  trigger: { kind: 'manual' },
  conditions: [],
  steps,
});
const read = (steps: unknown[]) => readItemRule(rule(steps), KINDS);
const card = {
  kind: 'plan_card',
  target: plan,
  board: 'b1',
  column: ' Done ',
  title: 'Review {{tab.name}}',
  description: '',
  assignee: '{{person}}',
  dueDays: 7,
  linkBack: true,
  skipIfOpen: true,
};

describe('the kinds', () => {
  it('are in every app’s registry, under In Other Apps, in their own words', () => {
    for (const k of crossAppActions()) {
      const def = KINDS.action(k.kind)!;
      expect(def.group).toBe(CROSS_APP_GROUP);
      expect(def.top).toBe(true);
      expect(def.format).toContain(`"kind":"${k.kind}"`);
    }
    // A knowledgebase's word for a tab never touches a document's tab.
    expect(KINDS.action('doc_tab')!.name).toBe('Add a Tab to a Document');
  });

  it('read a card step, trimming its column and taking defaults', () => {
    expect(read([card])).toEqual({
      body: expect.objectContaining({ steps: [{ ...card, column: 'Done' }] }),
    });
    const bare = read([
      {
        ...card,
        assignee: '',
        description: undefined,
        dueDays: undefined,
        linkBack: undefined,
        skipIfOpen: undefined,
      },
    ]);
    expect('body' in bare && bare.body.steps[0]).toEqual({
      kind: 'plan_card',
      target: plan,
      board: 'b1',
      column: 'Done',
      title: 'Review {{tab.name}}',
      description: '',
      linkBack: true,
      skipIfOpen: false,
    });
  });

  it('read a page, a post, a tab and a notice', () => {
    const steps = [
      { kind: 'kb_page', target: kb, parent: 'p9', title: 'Notes', body: '{{item.name}}' },
      { kind: 'kb_page', target: kb, parent: '', title: 'Top', body: 'x' },
      { kind: 'space_post', target: space, spaceTab: 't1', text: 'Hello' },
      { kind: 'doc_tab', target: { ...doc, title: undefined }, docTemplate: 'brief', name: 'New' },
      { kind: 'inbox_notice', to: [{ person: 'ana' }, { value: '{{person}}' }], text: 'Look' },
    ];
    const got = read(steps);
    expect('body' in got && got.body.steps).toEqual([
      steps[0],
      { kind: 'kb_page', target: kb, title: 'Top', body: 'x' },
      steps[2],
      { ...steps[3], target: { ...doc, title: '' } },
      steps[4],
    ]);
  });

  it('refuse a target of another app, a bad title, a flag that is not one and an unknown value', () => {
    const refusals = [
      [{ ...card, target: { ...plan, app: 'livediagram' } }, 'steps.0.target.app'],
      [{ ...card, target: { ...plan, title: 3 } }, 'steps.0.target.title'],
      [{ ...card, linkBack: 'yes' }, 'steps.0.linkBack'],
      [{ ...card, dueDays: 400 }, 'steps.0.dueDays'],
      [{ ...card, title: '{{nope}}' }, 'steps.0.title'],
      [{ kind: 'inbox_notice', to: [], text: 'x' }, 'steps.0.to'],
      [{ kind: 'inbox_notice', to: [{ who: 1 }], text: 'x' }, 'steps.0.to.0'],
    ] as const;
    for (const [step, path] of refusals) expect(read([step])).toMatchObject({ path });
    expect(
      read([{ kind: 'if', conditions: [{ kind: 'weekday', days: [1] }], then: [card], else: [] }]),
    ).toMatchObject({
      error: 'automation_step_unsupported',
    });
  });

  it(`hold a rule to ${CROSS_APP_STEPS_MAX} of them`, () => {
    expect(read(Array.from({ length: CROSS_APP_STEPS_MAX }, () => card))).toHaveProperty('body');
    expect(read(Array.from({ length: CROSS_APP_STEPS_MAX + 1 }, () => card))).toMatchObject({
      path: 'steps',
    });
  });

  it('say what they do, would do, and a reader’s words', () => {
    const steps = [
      card,
      { kind: 'kb_page', target: kb, title: 'Notes', body: 'b' },
      { kind: 'space_post', target: space, spaceTab: 't', text: 'Hi' },
      { kind: 'doc_tab', target: doc, docTemplate: 'x', name: 'Tab' },
      { kind: 'inbox_notice', to: [{ person: 'ana' }], text: 'Look' },
    ];
    const got = read(steps);
    if (!('body' in got)) throw new Error('refused');
    const chips = got.body.steps.map((s) => KINDS.action(s.kind)!.words(s, names));
    expect(chips.flat().map((c) => ('chip' in c ? c.chip : ''))).toEqual([
      'Create a Card in “Release Plan”',
      'Write a Page in “Docs”',
      'Post in “Office”',
      'Add a Tab “Tab” to “Brief”',
      'Notify Ana Costa',
    ]);
    const fill = (t: string) => t.replace('{{tab.name}}', 'Roadmap');
    expect(got.body.steps.map((s) => KINDS.action(s.kind)!.would(s, { fill, names }))).toEqual([
      'Would create a card “Review Roadmap” in “Release Plan”',
      'Would write a page “Notes” in “Docs”',
      'Would post in “Office”: Hi',
      'Would add a tab “Tab” to “Brief”',
      'Would notify Ana Costa: Look',
    ]);
    expect(got.body.steps.map((s) => KINDS.action(s.kind)!.summary!(s, names))).toEqual([
      'Create a Card in a Plan',
      'Write a Page in a Knowledgebase',
      'Post in a Space',
      'Add a Tab to a Document',
      'Notify 1 Person',
    ]);
    expect(
      itemRuleSentence({ ...got.body, id: 'r', enabled: true } as never, KINDS, names),
    ).toBeTruthy();
  });

  it('start empty, and say so before a target is picked', () => {
    const empty = crossAppActions().map((k) => k.defaults());
    expect(empty.map((p) => KINDS.action(p.kind)!.words(p, names)[0])).toEqual([
      { chip: 'Create a Card in a Plan' },
      { chip: 'Write a Page in a Knowledgebase' },
      { chip: 'Post in a Space' },
      { chip: 'Add a Tab “” to a livedocuments Document' },
      { chip: 'Notify ' },
    ]);
  });

  it('name a notice’s people in words', () => {
    const to = [{ person: 'ana' }, { value: 'Ben' }, { person: 'gone' }];
    expect(recipientsWords(to.slice(0, 2), names)).toBe('Ana Costa and Ben');
    expect(recipientsWords(to, names)).toBe('3 People');
    expect(recipientsWords(to)).toBe('3 People');
  });

  it('read a target alone, and every reader by its kind', () => {
    expect(readTarget({ app: 'livediagram', item: 'd2' }, 't', 'doc_tab')).toEqual({
      app: 'livediagram',
      item: 'd2',
      title: '',
    });
    expect(Object.keys(CROSS_APP_READERS)).toEqual([
      'plan_card',
      'kb_page',
      'space_post',
      'doc_tab',
      'inbox_notice',
    ]);
  });
});

describe('the chain', () => {
  it('reads what arrives with it, or nothing', () => {
    const chain = { id: 'c', hops: 1, rules: ['a'] };
    expect(readChain(chain)).toEqual(chain);
    for (const bad of [
      null,
      [],
      'c',
      { id: '', hops: 0, rules: [] },
      { id: 'c', hops: -1, rules: [] },
      { id: 'c', hops: CROSS_APP_HOPS_MAX + 1, rules: [] },
      { id: 'c', hops: 0, rules: 'a' },
      { id: 'c', hops: 0, rules: [''] },
      { id: 'c', hops: 0, rules: ['a', 'b', 'c', 'd', 'e'] },
    ])
      expect(readChain(bad)).toBeNull();
  });

  it('starts fresh, stops on a rule it ran or a fourth hop, and grows by one', () => {
    expect(chainOf(undefined, 'run-1')).toEqual({ id: 'run-1', hops: 0, rules: [] });
    const two = { id: 'c', hops: 2, rules: ['x', 'y'] };
    expect(chainStop(two, 'x')).toBe('loop');
    expect(chainStop(two, 'z')).toBeNull();
    expect(chainStop({ ...two, hops: CROSS_APP_HOPS_MAX }, 'z')).toBe('chain_long');
    expect(nextChain(two, 'z')).toEqual({ id: 'c', hops: 3, rules: ['x', 'y', 'z'] });
    expect(nextChain({ id: 'c', hops: 3, rules: ['a', 'b', 'c', 'd'] }, 'e').rules).toEqual([
      'b',
      'c',
      'd',
      'e',
    ]);
  });
});

describe('the words', () => {
  it('name an app, a target, and each refusal', () => {
    expect(appWord('liveknowledge')).toBe('liveknowledge');
    expect(targetWords({ app: 'liveknowledge', item: 'k', title: '' }, 'a knowledgebase')).toBe(
      '“Untitled”',
    );
    expect(targetWords({ app: 'liveknowledge', item: '', title: '' }, 'a knowledgebase')).toBe(
      'a knowledgebase',
    );
    const target = { app: 'liveknowledge' as const, item: 'k', title: 'Docs' };
    expect(noAccessWords(null)).toBe('Stopped: no access to the people');
    // A pause on lost access (or no author) is the one Take Over Rule answers; a failure's is not.
    expect(isAccessPause(noAccessWords(null))).toBe(true);
    expect(isAccessPause(CROSS_APP_NO_AUTHOR)).toBe(true);
    expect(isAccessPause('The webhook answered 500')).toBe(false);
    expect(refusalWords('no_access', '', target)).toBe('Stopped: no access to “Docs”');
    expect(refusalWords('loop', '', target)).toBe(CROSS_APP_LOOP);
    expect(refusalWords('chain_long', '', target)).toBe(CROSS_APP_CHAIN_LONG);
    expect(refusalWords('capped', '', target)).toBe(CROSS_APP_AUTHOR_CAPPED);
    expect(refusalWords('unavailable', '', target)).toBe(CROSS_APP_UNREACHED);
    expect(refusalWords('target_gone', 'The board is gone', target)).toBe('The board is gone');
    expect(refusalWords('failed', '', target)).toBe("Couldn't do it in the other app");
  });
});

describe('a step’s chip for an app whose sentence is its own', () => {
  it('words each kind as the registry does', () => {
    const t = (app: string) => ({ app, item: 'i1', title: 'Launch' }) as never;
    expect(crossAppChip({ kind: 'plan_card', target: t('liveplanner') } as never)).toBe(
      'Create a Card in “Launch”',
    );
    expect(crossAppChip({ kind: 'kb_page', target: t('liveknowledge') } as never)).toBe(
      'Write a Page in “Launch”',
    );
    expect(crossAppChip({ kind: 'space_post', target: t('livehuddle') } as never)).toBe(
      'Post in “Launch”',
    );
    expect(
      crossAppChip({ kind: 'doc_tab', target: t('livedocuments'), name: 'Notes' } as never),
    ).toBe('Add a Tab “Notes” to “Launch”');
    expect(
      crossAppChip({ kind: 'inbox_notice', to: [{ value: 'a' }, { value: 'b' }] } as never),
    ).toBe('Notify 2 People');
  });
});
