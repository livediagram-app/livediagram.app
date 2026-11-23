import { describe, expect, it } from 'vitest';
import {
  LABEL_NAME_MAX,
  LABEL_REFUSAL_WORDS,
  MAX_KNOWLEDGEBASE_LABELS,
  MAX_PAGE_LABELS,
  applyLabelChange,
  isLabelColour,
  labelName,
  labelPageCounts,
  labelsByUse,
  newLabelId,
  nextLabelColour,
  pageLabelsOf,
  pagesLabelled,
  parseKnowledgeLabels,
  parseTabLabels,
  resolveLabels,
  withSettledLabels,
  withTabLabels,
  type KnowledgeLabel,
} from './page-labels';
import { migrateStoredTab } from './stored-tab';

const eng: KnowledgeLabel = { id: 'lbl_eng', name: 'Engineering', colour: 'blue' };
const onb: KnowledgeLabel = { id: 'lbl_onb', name: 'Onboarding', colour: '#aabbcc' };

describe('a label', () => {
  it('keeps a name trimmed, its spaces made one, within 40 characters', () => {
    expect(labelName('  Product   Team ')).toBe('Product Team');
    expect(labelName('x'.repeat(LABEL_NAME_MAX))).toHaveLength(LABEL_NAME_MAX);
    // Letters past the C1 controls are kept: an accent, a dash, a CJK name.
    expect(labelName('Caf\u00e9 \u2013 \u7814\u7a76')).toBe('Caf\u00e9 \u2013 \u7814\u7a76');
    for (const bad of [
      '',
      '   ',
      'x'.repeat(LABEL_NAME_MAX + 1),
      'a\u0007b',
      'a\u0085b',
      'a\u007fb',
      'a,b',
      3,
      null,
    ])
      expect(labelName(bad)).toBeUndefined();
  });

  it('takes a standard colour by name or a #rrggbb', () => {
    expect(['blue', 'grey', '#A0b1C2'].every(isLabelColour)).toBe(true);
    expect(['navy', '#abc', '', 3].some(isLabelColour)).toBe(false);
  });

  it('makes ids of lbl_ and ten base-36 characters', () => {
    expect(newLabelId(() => 0)).toBe('lbl_0000000000');
    expect(newLabelId()).toMatch(/^lbl_[0-9a-z]{10}$/);
  });
});

describe('reading labels forgivingly', () => {
  it('keeps the valid labels, the first of a repeated id or name, colours in lower case', () => {
    expect(
      parseKnowledgeLabels([
        eng,
        { ...onb, colour: '#AABBCC' },
        { id: 'lbl_eng', name: 'Other', colour: 'red' },
        { id: 'lbl_x', name: 'engineering', colour: 'red' },
        { id: 'bad id', name: 'Bad', colour: 'red' },
        { id: 'lbl_y', name: '', colour: 'red' },
        { id: 'lbl_z', name: 'Z', colour: 'navy' },
        null,
        'x',
      ]),
    ).toEqual([eng, onb]);
    expect(parseKnowledgeLabels('nope')).toEqual([]);
  });

  it('holds at most 100 labels', () => {
    const many = Array.from({ length: MAX_KNOWLEDGEBASE_LABELS + 5 }, (_, i) => ({
      id: `l${i}`,
      name: `Label ${i}`,
      colour: 'blue',
    }));
    expect(parseKnowledgeLabels(many)).toHaveLength(MAX_KNOWLEDGEBASE_LABELS);
  });

  it("reads a page's ids: ids only, no repeat, at most 10", () => {
    expect(parseTabLabels(['a', 'a', 'b', 3, 'bad id'])).toEqual(['a', 'b']);
    expect(parseTabLabels(Array.from({ length: 15 }, (_, i) => `l${i}`))).toHaveLength(
      MAX_PAGE_LABELS,
    );
    expect(parseTabLabels(undefined)).toEqual([]);
  });

  it('settles a tab as it is read, the same tab when nothing changes', () => {
    const plain = { id: 't' };
    expect(withSettledLabels(plain)).toBe(plain);
    const good = { id: 't', labels: ['a'] };
    expect(withSettledLabels(good)).toBe(good);
    expect(withSettledLabels({ id: 't', labels: ['a', 'a'] })).toEqual({ id: 't', labels: ['a'] });
    expect(withSettledLabels({ id: 't', labels: 'a' })).toEqual({ id: 't' });
    const stored = migrateStoredTab({ elements: [], labels: ['a', 7] } as never) as {
      labels?: unknown;
    };
    expect(stored.labels).toEqual(['a']);
  });

  it('puts ids on a tab, and takes the field away for none', () => {
    const tab = { id: 't', labels: ['a'] };
    expect(withTabLabels(tab, ['a'])).toBe(tab);
    expect(withTabLabels(tab, ['a', 'b'])).toEqual({ id: 't', labels: ['a', 'b'] });
    expect(withTabLabels(tab, [])).toEqual({ id: 't' });
    const bare = { id: 't' };
    expect(withTabLabels(bare, [])).toBe(bare);
  });

  it("shows a page's labels that exist, in the page's order", () => {
    expect(pageLabelsOf(['lbl_onb', 'gone', 'lbl_eng'], [eng, onb])).toEqual([onb, eng]);
    expect(pageLabelsOf(undefined, [eng])).toEqual([]);
  });
});

describe('changing the labels', () => {
  const list = [eng];

  it('adds a label in lower-case colour, and refuses a bad one by name', () => {
    expect(
      applyLabelChange(list, { kind: 'add', id: 'lbl_n', name: ' New ', colour: '#ABCDEF' }),
    ).toEqual({
      labels: [eng, { id: 'lbl_n', name: 'New', colour: '#abcdef' }],
      label: { id: 'lbl_n', name: 'New', colour: '#abcdef' },
    });
    const add = (over: Record<string, unknown>) =>
      applyLabelChange(list, {
        kind: 'add',
        id: 'lbl_n',
        name: 'N',
        colour: 'red',
        ...over,
      } as never);
    expect(add({ id: 'bad id' })).toEqual({ refusal: 'invalid_label_id' });
    expect(add({ id: 'lbl_eng' })).toEqual({ refusal: 'invalid_label_id' });
    expect(add({ name: '' })).toEqual({ refusal: 'invalid_label_name' });
    expect(add({ colour: 'navy' })).toEqual({ refusal: 'invalid_label_colour' });
    expect(add({ name: 'ENGINEERING' })).toEqual({ refusal: 'label_name_taken' });
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_LABELS }, (_, i) => ({
      id: `l${i}`,
      name: `L${i}`,
      colour: 'blue',
    }));
    expect(applyLabelChange(full, { kind: 'add', id: 'lbl_n', name: 'N', colour: 'red' })).toEqual({
      refusal: 'label_limit',
    });
  });

  it('renames in one change, a case change of its own name included', () => {
    const both = [eng, onb];
    expect(applyLabelChange(both, { kind: 'rename', id: 'lbl_eng', name: 'engineering' })).toEqual({
      labels: [{ ...eng, name: 'engineering' }, onb],
      label: { ...eng, name: 'engineering' },
    });
    expect(applyLabelChange(both, { kind: 'rename', id: 'lbl_eng', name: 'onboarding' })).toEqual({
      refusal: 'label_name_taken',
    });
    expect(applyLabelChange(both, { kind: 'rename', id: 'lbl_eng', name: ' ' })).toEqual({
      refusal: 'invalid_label_name',
    });
    expect(applyLabelChange(both, { kind: 'rename', id: 'lbl_x', name: 'X' })).toEqual({
      refusal: 'unknown_label',
    });
  });

  it('recolours and deletes', () => {
    expect(applyLabelChange(list, { kind: 'recolour', id: 'lbl_eng', colour: 'GREEN' })).toEqual({
      refusal: 'invalid_label_colour',
    });
    expect(applyLabelChange(list, { kind: 'recolour', id: 'lbl_eng', colour: '#00FF00' })).toEqual({
      labels: [{ ...eng, colour: '#00ff00' }],
      label: { ...eng, colour: '#00ff00' },
    });
    expect(applyLabelChange(list, { kind: 'recolour', id: 'lbl_eng', colour: 'x' })).toEqual({
      refusal: 'invalid_label_colour',
    });
    expect(applyLabelChange(list, { kind: 'delete', id: 'lbl_eng' })).toEqual({ labels: [] });
    expect(list).toEqual([eng]);
  });

  it('says every refusal in words', () => {
    for (const words of Object.values(LABEL_REFUSAL_WORDS)) expect(words).toMatch(/\.$/);
  });
});

describe('labels across pages', () => {
  const pages = [
    { id: 'p1', labels: ['lbl_eng'] },
    { id: 'p2', labels: ['lbl_eng', 'lbl_onb'] },
    { id: 'p3' },
  ];

  it('counts the pages carrying each, and lists the most used first, then by name', () => {
    const counts = labelPageCounts(pages);
    expect([...counts]).toEqual([
      ['lbl_eng', 2],
      ['lbl_onb', 1],
    ]);
    const zed = { id: 'lbl_z', name: 'Zed', colour: 'red' };
    const abc = { id: 'lbl_a', name: 'abc', colour: 'red' };
    expect(labelsByUse([zed, onb, abc, eng], counts).map((l) => l.id)).toEqual([
      'lbl_eng',
      'lbl_onb',
      'lbl_a',
      'lbl_z',
    ]);
  });

  it('resolves a scope by id or by name, ignoring case', () => {
    expect(resolveLabels([eng, onb], ['engineering', ' lbl_onb ', '', 'Engineering'])).toEqual({
      ids: ['lbl_eng', 'lbl_onb'],
    });
    expect(resolveLabels([eng], ['Sales'])).toEqual({ unknown: 'Sales' });
  });

  it('finds the pages carrying any of the labels', () => {
    expect([...pagesLabelled(pages, ['lbl_onb', 'lbl_x'])]).toEqual(['p2']);
    expect([...pagesLabelled(pages, ['lbl_eng'])]).toEqual(['p1', 'p2']);
    expect(pagesLabelled(pages, []).size).toBe(0);
  });

  it('gives a new label the next colour not taken, then rounds again', () => {
    expect(nextLabelColour([])).toBe('blue');
    expect(nextLabelColour([eng])).toBe('green');
    const all = ['blue', 'green', 'orange', 'violet', 'teal', 'pink', 'red', 'yellow', 'grey'].map(
      (colour, i) => ({ id: `l${i}`, name: `L${i}`, colour }),
    );
    expect(nextLabelColour(all)).toBe('blue');
  });
});
