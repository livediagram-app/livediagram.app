import { describe, expect, it } from 'vitest';
import { id } from '../validate-read';
import {
  defineAction,
  defineItemKinds,
  mapOwnRefs,
  ownNeedLine,
  ownRefsOf,
  readItemDraft,
  ruleLeftToPick,
  ruleOwnUnpicked,
  rulesFromFile,
  type ItemOwnRef,
  type ItemPart,
  type ItemRuleBody,
} from './index';

const VERSION: ItemOwnRef = { field: 'version', noun: 'a version', title: 'Version' };

/** An app whose step names a tab's named version. */
export const OWN_KINDS = defineItemKinds({
  itemWord: 'document',
  collab: false,
  tabTemplates: false,
  ownRefs: [VERSION],
  actions: [
    defineAction<{ kind: 'restore_version'; tab: string; version: string } & ItemPart>({
      kind: 'restore_version',
      name: 'Restore a Version',
      group: 'Versions',
      line: 'puts a tab back to one of its named versions',
      format: '{"kind":"restore_version","tab":tab,"version":a named version’s id}',
      read: (value, path) => ({
        kind: 'restore_version',
        tab: id(value['tab'], `${path}.tab`),
        version: id(value['version'], `${path}.version`),
      }),
      defaults: () => ({ kind: 'restore_version', tab: '', version: '' }),
      words: () => [{ chip: 'Restore a Version' }],
      would: () => 'Would restore a version',
    }),
  ],
});

const rule = (version: string, tab = 't1'): ItemRuleBody => ({
  name: 'Nightly reset',
  trigger: { kind: 'manual' },
  conditions: [],
  steps: [{ kind: 'restore_version', tab, version }],
  chain: false,
  timeZone: 'UTC',
});

describe('a reference of an app’s own', () => {
  it('is on the registry only when the app declares one', () => {
    expect(OWN_KINDS.ownRefs).toEqual([VERSION]);
    const plain = defineItemKinds({ itemWord: 'document', collab: false, tabTemplates: false });
    expect(plain).not.toHaveProperty('ownRefs');
    expect(
      defineItemKinds({ itemWord: 'document', collab: false, tabTemplates: false, ownRefs: [] }),
    ).not.toHaveProperty('ownRefs');
  });

  it('is listed and rewritten by its field, wherever a rule holds it', () => {
    const value = {
      steps: [
        { kind: 'restore_version', version: 'v1' },
        { kind: 'if', then: [{ version: 'v2' }, { version: 'v1' }, { version: 7 }], else: 'x' },
      ],
    };
    expect(ownRefsOf(value, [VERSION])).toEqual([
      { field: 'version', id: 'v1' },
      { field: 'version', id: 'v2' },
    ]);
    expect(mapOwnRefs(value, [VERSION], (ref) => `${ref.id}!`)).toEqual({
      steps: [
        { kind: 'restore_version', version: 'v1!' },
        { kind: 'if', then: [{ version: 'v2!' }, { version: 'v1!' }, { version: 7 }], else: 'x' },
      ],
    });
    // An app that declares none pays nothing: the value itself comes back.
    expect(mapOwnRefs(value, undefined, () => 'x')).toBe(value);
    expect(mapOwnRefs(value, [], () => 'x')).toBe(value);
    expect(ownRefsOf(value, undefined)).toEqual([]);
  });

  it('left empty is still to pick, so the rule is not turned on', () => {
    expect(ruleOwnUnpicked(rule('v1'), OWN_KINDS)).toEqual([]);
    expect(ruleOwnUnpicked(rule(''), OWN_KINDS)).toEqual([VERSION]);
    expect(ruleOwnUnpicked(rule(''), {})).toEqual([]);
    expect(ruleLeftToPick(rule('v1'), OWN_KINDS)).toBe(false);
    expect(ruleLeftToPick(rule(''), OWN_KINDS)).toBe(true);
    expect(ruleLeftToPick(rule('v1', ''), OWN_KINDS)).toBe(true);
    expect(ownNeedLine(VERSION, '')).toBe('Pick a version');
    expect(ownNeedLine(VERSION, 'v1')).toBe('Version v1 is gone');
  });

  it('is the source’s own: a copy leaves it to pick and lands off, a file keeps it', () => {
    const stamp = { by: { id: 'a', name: 'Ana', color: '#111111' }, at: 1 };
    const filed = [{ ...rule('v1'), enabled: true }];
    const kept = rulesFromFile(filed, OWN_KINDS, { stamp });
    expect(kept.rules[0]).toMatchObject({ enabled: true, steps: [{ tab: 't1', version: 'v1' }] });
    const copied = rulesFromFile(filed, OWN_KINDS, {
      stamp,
      copy: true,
      tabs: new Map([['t1', 'n1']]),
    });
    expect(copied.rules[0]).toMatchObject({ enabled: false, steps: [{ tab: 'n1', version: '' }] });
    // A file that already left it empty reads, and stays off.
    const empty = rulesFromFile([{ ...rule(''), enabled: true }], OWN_KINDS, { stamp });
    expect(empty).toMatchObject({
      dropped: 0,
      rules: [{ enabled: false, steps: [{ version: '' }] }],
    });
  });

  it('is never the model’s to pick in a drafted rule', () => {
    const out = readItemDraft(
      { outcome: 'rule', rule: rule('v-made-up', 'Board') },
      { prompt: 'reset the board nightly', timeZone: 'UTC', rules: [] },
      OWN_KINDS,
      { tabs: [{ id: 't1', name: 'Board' }] },
    );
    expect(out).toMatchObject({ body: { steps: [{ tab: 't1', version: '' }] } });
  });
});
