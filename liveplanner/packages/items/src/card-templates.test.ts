import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  CARD_TEMPLATES_BYTES,
  CARD_TEMPLATE_BYTES,
  CARD_TEMPLATES_MAX,
  cardTemplateFields,
  cardTemplatesBytes,
  newCardTemplateId,
  readCardTemplates,
  templateTakes,
  withoutTemplates,
  type CardTemplate,
} from './card-templates';
import type { ItemTypeDef } from './item-types';
import { defaultCatalogue, validateItemTypeCatalogue } from './type-catalogue';
import { duplicateItemType } from './type-duplicate';
import { detachType } from './type-inheritance';

// docs/specs/026-plan/item-types.md "Card templates": named starting values on a card type, read against its fields.

const BUG = {
  id: 'bug',
  label: 'Bug',
  color: '#dc2626',
  glyph: 'bug',
  fields: [
    'description',
    'checklist',
    'labels',
    'priority',
    'f-steps',
    'f-area',
    'f-reporter',
    'f-score',
    'f-notes',
    'f-blocked',
    'f-shot',
    'f-spent',
    'f-thread',
  ],
  custom: [
    { id: 'f-steps', label: 'Steps', kind: 'longtext' },
    { id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'] },
    { id: 'f-reporter', label: 'Reporter', kind: 'person' },
    { id: 'f-score', label: 'Score', kind: 'calculated', calculation: 'childCount' },
    { id: 'f-notes', label: 'Notes', kind: 'text' },
    { id: 'f-blocked', label: 'Blocked By', kind: 'card', linkType: 'bug' },
    { id: 'f-shot', label: 'Shot', kind: 'image' },
    { id: 'f-spent', label: 'Spent', kind: 'duration', timeSpent: true },
    { id: 'f-thread', label: 'Thread', kind: 'comments' },
  ],
};

const REPORT = {
  id: 'tp-bug-report',
  name: 'Bug Report',
  fields: {
    title: 'Bug: something broke',
    description: 'What happened?',
    checklist: [{ text: 'Reproduce it', done: false }],
    labels: ['triage'],
    'f-steps': '1. Open\n2. Click',
    'f-area': 'Web',
  },
};

const catalogue = (...types: unknown[]) => ({ version: 1, types });
const read = (type: unknown, mode: 'keep' | 'refuse' = 'keep') =>
  validateItemTypeCatalogue(catalogue(type), { newerFields: mode });
const firstType = (type: unknown, mode: 'keep' | 'refuse' = 'keep'): ItemTypeDef => {
  const r = read(type, mode);
  if (!r.ok) throw new Error(r.reason);
  return r.catalogue.types[0]!;
};
const reason = (type: unknown, mode: 'keep' | 'refuse' = 'keep') => {
  const r = read(type, mode);
  return r.ok ? null : r.reason;
};

describe('card templates on a type', () => {
  it('reads a type’s templates in order, each value as a card stores it', () => {
    const second = { id: 'tp-crash', name: 'Crash', fields: { labels: [' crash ', 'crash'] } };
    const type = firstType({ ...BUG, templates: [REPORT, second] }, 'refuse');
    expect(type.templates).toEqual([
      REPORT,
      { id: 'tp-crash', name: 'Crash', fields: { labels: ['crash'] } },
    ]);
  });

  it('reads an old plan’s types unchanged: no templates, no key', () => {
    // A stored catalogue is the normalised one: reading it again gives the same bytes, and no type gains a key.
    const stored = validateItemTypeCatalogue(defaultCatalogue());
    if (!stored.ok) throw new Error(stored.reason);
    const again = validateItemTypeCatalogue(JSON.parse(JSON.stringify(stored.catalogue)));
    expect(again.ok && JSON.stringify(again.catalogue)).toBe(JSON.stringify(stored.catalogue));
    expect(stored.catalogue.types.some((t) => 'templates' in t)).toBe(false);
    expect('templates' in firstType({ ...BUG, templates: [] })).toBe(false);
  });

  it('takes a template with no values, and drops a blank title for the type’s new-card title', () => {
    const type = firstType({
      ...BUG,
      templates: [
        { id: 'tp-empty', name: 'Empty' },
        { id: 'tp-blank', name: 'Blank', fields: { title: '  ' } },
      ],
    });
    expect(type.templates!.map((t) => t.fields)).toEqual([{}, {}]);
  });

  it('refuses a list that is not one, or holds more than the cap', () => {
    expect(reason({ ...BUG, templates: {} })).toBe('types[0].templates');
    const many = Array.from({ length: CARD_TEMPLATES_MAX + 1 }, (_, i) => ({
      id: `tp-t${i}`,
      name: `T${i}`,
    }));
    expect(reason({ ...BUG, templates: many })).toBe('types[0].templates');
    expect(firstType({ ...BUG, templates: many.slice(1) }).templates).toHaveLength(
      CARD_TEMPLATES_MAX,
    );
  });

  it('refuses a bad or repeated id, and a blank, long or repeated name, by place', () => {
    expect(reason({ ...BUG, templates: ['x'] })).toBe('types[0].templates[0]');
    for (const id of [undefined, 'bug-report', 'tp-', 'tp-Bug', `tp-${'a'.repeat(30)}`])
      expect(reason({ ...BUG, templates: [{ ...REPORT, id }] })).toBe('types[0].templates[0].id');
    expect(reason({ ...BUG, templates: [REPORT, { ...REPORT, name: 'Other' }] })).toBe(
      'types[0].templates[1].id',
    );
    for (const name of ['', '   ', 'x'.repeat(33), 3])
      expect(reason({ ...BUG, templates: [{ ...REPORT, name }] })).toBe(
        'types[0].templates[0].name',
      );
    expect(reason({ ...BUG, templates: [REPORT, { id: 'tp-two', name: ' bug REPORT ' }] })).toBe(
      'types[0].templates[1].name',
    );
    expect(
      firstType({ ...BUG, templates: [{ ...REPORT, name: ' Bug Report ' }] }).templates![0]!.name,
    ).toBe('Bug Report');
  });

  it('checks each value as a card’s field is checked', () => {
    const bad = [
      { title: 'x'.repeat(501) },
      { description: 'x'.repeat(10_001) },
      { labels: Array.from({ length: 13 }, (_, i) => `l${i}`) },
      { checklist: [{ text: 'no done' }] },
      { 'f-reporter': { id: 'p1' } },
    ];
    for (const fields of bad) {
      expect(reason({ ...BUG, templates: [{ ...REPORT, fields }] })).toBe(
        'types[0].templates[0].fields',
      );
    }
    expect(reason({ ...BUG, templates: [{ ...REPORT, fields: [] }] })).toBe(
      'types[0].templates[0].fields',
    );
  });

  it('refuses a template past 16 KB', () => {
    const fields = {
      description: 'x'.repeat(9_000),
      'f-steps': 'y'.repeat(2_000),
      'f-notes': 'z'.repeat(2_000),
    };
    const big = {
      ...REPORT,
      fields: {
        ...fields,
        checklist: Array.from({ length: 30 }, () => ({ text: 'w'.repeat(200), done: false })),
      },
    };
    expect(reason({ ...BUG, templates: [big] })).toBe('types[0].templates[0]');
    expect(reason({ ...BUG, templates: [{ ...REPORT, fields }] })).toBeNull();
  });

  it('drops a value for a field the type no longer offers, keeping the rest', () => {
    const type = firstType({
      ...BUG,
      fields: ['description', 'f-area'],
      templates: [{ ...REPORT, fields: { ...REPORT.fields, 'f-gone': 'x', 'f-stepsRich': [] } }],
    });
    expect(type.templates![0]!.fields).toEqual({
      title: 'Bug: something broke',
      description: 'What happened?',
      'f-area': 'Web',
    });
  });

  it('keeps a description’s and a Long Text’s formatting beside them', () => {
    const runs = [{ text: 'What happened?', marks: { bold: true } }];
    const fields = {
      description: 'What happened?',
      descriptionRich: runs,
      'f-steps': 'Go',
      'f-stepsRich': [{ text: 'Go' }],
    };
    const type = firstType({ ...BUG, templates: [{ ...REPORT, fields }] }, 'refuse');
    expect(Object.keys(type.templates![0]!.fields).sort()).toEqual([
      'description',
      'descriptionRich',
      'f-steps',
      'f-stepsRich',
    ]);
  });

  it('refuses on the api’s write a value a template never holds', () => {
    const never = [
      { status: 'todo' },
      { priority: 'high' },
      { 'f-score': 2 },
      { 'f-blocked': 'card12' },
      { 'f-shot': 'img1' },
      { 'f-spent': 30 },
      { 'f-notesRich': [{ text: 'x' }] },
    ];
    for (const fields of never)
      expect(reason({ ...BUG, templates: [{ ...REPORT, fields }] }, 'refuse')).toBe(
        'types[0].templates[0].fields',
      );
  });

  it('keeps on a read a value a newer build may set, when a card could hold it, and never puts it on a card', () => {
    const fields = {
      title: 'Bug',
      priority: 'high',
      'f-thread': 'x',
      'f-score': { not: 'a value' },
    };
    const type = firstType({ ...BUG, templates: [{ ...REPORT, fields }] });
    const template = type.templates![0]!;
    // f-thread passes the card check as a plain value; f-score's object does not, so it is dropped, never refused.
    expect(template.fields).toEqual({ title: 'Bug', priority: 'high', 'f-thread': 'x' });
    expect(cardTemplateFields(type, template)).toEqual({ title: 'Bug' });
  });

  it('keeps a template key a newer build stored on a read, and drops it on the api’s write', () => {
    const template = { ...REPORT, glyph: 'bug' };
    expect(firstType({ ...BUG, templates: [template] }).templates![0]).toMatchObject({
      glyph: 'bug',
    });
    expect(firstType({ ...BUG, templates: [template] }, 'refuse').templates![0]).not.toHaveProperty(
      'glyph',
    );
  });
});

describe('what a template sets', () => {
  it('takes the title, Description, Checklist, Labels and the custom fields a card fills in', () => {
    const type = firstType(BUG);
    const takes = (key: string) => templateTakes(type, key);
    for (const key of [
      'title',
      'description',
      'descriptionRich',
      'checklist',
      'labels',
      'f-steps',
      'f-stepsRich',
      'f-area',
      'f-reporter',
      'f-notes',
    ])
      expect(takes(key), key).toBe(true);
    for (const key of [
      'status',
      'assignee',
      'priority',
      'due',
      'f-score',
      'f-blocked',
      'f-shot',
      'f-spent',
      'f-thread',
      'f-notesRich',
      'f-gone',
    ])
      expect(takes(key), key).toBe(false);
    // A field from a newer version is never filled in from here.
    const newer = {
      ...BUG,
      custom: [...BUG.custom, { id: 'f-later', label: 'Later', kind: 'hologram' }],
    };
    expect(
      templateTakes(
        { fields: [...BUG.fields, 'f-later'], custom: newer.custom as never },
        'f-later',
      ),
    ).toBe(false);
  });

  it('gives a new card only the values for fields its type offers at that moment', () => {
    const type = firstType({ ...BUG, templates: [REPORT] });
    const narrowed = {
      ...type,
      fields: type.fields.filter((f) => f !== 'checklist' && f !== 'f-area'),
    };
    expect(cardTemplateFields(narrowed, type.templates![0]!)).toEqual({
      title: 'Bug: something broke',
      description: 'What happened?',
      labels: ['triage'],
      'f-steps': '1. Open\n2. Click',
    });
  });

  it('mints ids from the name, unique in the type, cut to fit', () => {
    expect(newCardTemplateId('Bug Report', [])).toBe('tp-bug-report');
    expect(newCardTemplateId('Bug Report', ['tp-bug-report'])).toBe('tp-bug-report-2');
    expect(newCardTemplateId('!!!', [])).toBe('tp-template');
    const long = newCardTemplateId('A very long template name that goes on', []);
    expect(long.length).toBeLessThanOrEqual(32);
    expect(long).toMatch(/^tp-[a-z0-9-]{1,29}$/);
    expect(newCardTemplateId('x'.repeat(40), ['tp-' + 'x'.repeat(29)])).toMatch(/^tp-x+-2$/);
  });
});

describe('the templates’ own budget', () => {
  // One type's ten templates, each `size` bytes of description.
  const full = (id: string, size: number) => ({
    ...BUG,
    id,
    label: id,
    templates: Array.from({ length: CARD_TEMPLATES_MAX }, (_, i) => ({
      id: `tp-t${i}`,
      name: `T${i}`,
      fields: { description: 'x'.repeat(size) },
    })),
  });

  it('counts templates apart from the catalogue’s 32 KB, and refuses past 128 KB', () => {
    // 64 KB of templates on two types: far past the catalogue's own 32 KB, inside the templates' budget.
    const r = validateItemTypeCatalogue(catalogue(full('a', 3_200), full('b', 3_200)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(cardTemplatesBytes(r.catalogue.types)).toBeGreaterThan(64_000);
    const over = validateItemTypeCatalogue(
      catalogue(...['a', 'b', 'c', 'd', 'e'].map((id) => full(id, 3_200))),
    );
    expect(over).toEqual({ ok: false, reason: 'templates' });
  });

  it('measures only the types that hold templates, and strips them for the types’ count', () => {
    expect(cardTemplatesBytes([{}, { templates: [] }])).toBe(0);
    const t: CardTemplate = { id: 'tp-a', name: 'A', fields: {} };
    expect(cardTemplatesBytes([{ templates: [t] }])).toBe(JSON.stringify([t]).length);
    const bare = {};
    expect(withoutTemplates(bare)).toBe(bare);
    expect(withoutTemplates({ templates: [t], x: 1 } as never)).toEqual({ x: 1 });
  });

  it('validates a catalogue holding the whole 128 KB of templates quickly', () => {
    const big = catalogue(...['a', 'b', 'c', 'd'].map((id) => full(id, 3_150)));
    const once = validateItemTypeCatalogue(big);
    expect(once.ok && cardTemplatesBytes(once.catalogue.types)).toBeGreaterThan(
      CARD_TEMPLATES_BYTES * 0.95,
    );
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 50; i++) validateItemTypeCatalogue(big);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });

  it('holds one template to a card’s field budget', () => {
    expect(CARD_TEMPLATE_BYTES).toBe(16_384);
    expect(readCardTemplates([], BUG as never, 'types[0]', 'keep')).toEqual([]);
  });
});

describe('templates are the type’s own', () => {
  const WORK = {
    id: 'work',
    label: 'Work',
    color: '#71717a',
    glyph: 'task',
    fields: ['description', 'checklist'],
    templates: [{ id: 'tp-work', name: 'Work', fields: { description: 'Base' } }],
  };
  const STORY = {
    id: 'story',
    label: 'Story',
    color: '#2563eb',
    glyph: 'task',
    fields: ['f-points'],
    custom: [{ id: 'f-points', label: 'Points', kind: 'number' }],
    inherits: 'work',
    templates: [
      {
        id: 'tp-story',
        name: 'Story',
        fields: { checklist: [{ text: 'Write it', done: false }], 'f-points': 3 },
      },
    ],
  };

  it('keeps an inherited type’s own templates, never its base type’s, setting inherited fields too', () => {
    const r = validateItemTypeCatalogue(catalogue(WORK, STORY));
    if (!r.ok) throw new Error(r.reason);
    const [work, story] = r.catalogue.types;
    expect(work!.templates!.map((t) => t.id)).toEqual(['tp-work']);
    expect(story!.templates).toEqual(STORY.templates);
    // A type with none of its own takes none from its base.
    const bare = validateItemTypeCatalogue(catalogue(WORK, { ...STORY, templates: undefined }));
    expect(bare.ok && bare.catalogue.types[1]!.templates).toBeUndefined();
    expect(detachType(story!).templates).toEqual(STORY.templates);
  });

  it('copies them, whole and apart, with a duplicated type', () => {
    const bug = firstType({ ...BUG, templates: [REPORT] });
    const copy = duplicateItemType(bug, [bug]);
    expect(copy.templates).toEqual(bug.templates);
    expect(copy.templates![0]!.fields).not.toBe(bug.templates![0]!.fields);
    expect('templates' in duplicateItemType(firstType(BUG), [])).toBe(false);
  });
});
