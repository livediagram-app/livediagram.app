// The Import dialog's preview of a plan file (docs/specs/026-plan/plan-tabs.md "The Import dialog", A Whole Plan).
import { describe, expect, it } from 'vitest';
import { defaultCatalogue, type Item } from '@liveplanner/items';
import { projectToEnvelopeText } from './project-envelope';
import { summariseProjectFile } from './project-file-summary';

const PERSON = { id: 'p', name: 'Ada', color: '#123456' };
const card = (id: string, key: number, fields: Item['fields'] = { title: id }): Item => ({
  id,
  type: 'task',
  key,
  rank: `a${key}`,
  fields,
  rev: 1,
  createdAt: 1,
  updatedAt: 1,
  createdBy: PERSON,
  updatedBy: PERSON,
});
const tab = (id: string) => ({ id, name: id, elements: [] });
const DEFAULTS = defaultCatalogue();
// The Task with an Image field.
const WITH_IMAGE = {
  ...DEFAULTS,
  types: DEFAULTS.types.map((t) =>
    t.id === 'task'
      ? {
          ...t,
          fields: [...t.fields, 'f-shot'],
          custom: [{ id: 'f-shot', label: 'Shot', kind: 'image' as const }],
        }
      : t,
  ),
};
const thread = {
  id: 'th-aaaaaaaaaaaaaaaa',
  title: '',
  resolved: false,
  comments: [{ id: 'cm1', text: 'Hi', createdAt: 1, authorName: 'Ada', authorColor: '#000000' }],
  createdAt: 1,
  createdBy: { name: 'Ada', color: '#000000' },
  updatedAt: 1,
  home: 'A',
  cards: [{ projectId: 'A', itemId: 'c1', key: 1 }],
  rev: 1,
};

describe('summariseProjectFile', () => {
  it('counts the tabs, cards, card types, threads and rules a file holds', () => {
    const text = projectToEnvelopeText(
      { id: 'A', name: 'Roadmap' },
      [tab('t1'), tab('t2')],
      5,
      [card('c1', 1), card('c2', 2)],
      DEFAULTS,
      [],
      [thread as never],
      [{ id: 'r1', name: 'Rule' } as never],
    );
    expect(summariseProjectFile(text)).toEqual({
      ok: true,
      summary: {
        name: 'Roadmap',
        tabs: 2,
        cards: 2,
        cardTypes: DEFAULTS.types.length,
        threads: 1,
        rules: 1,
        pictures: false,
      },
    });
  });

  it('reads a file of tabs alone as nothing else, and no pictures', () => {
    const text = projectToEnvelopeText({ id: 'A', name: 'Empty' }, [tab('t1')], 0);
    expect(summariseProjectFile(text)).toEqual({
      ok: true,
      summary: {
        name: 'Empty',
        tabs: 1,
        cards: 0,
        cardTypes: 0,
        threads: 0,
        rules: 0,
        pictures: false,
      },
    });
  });

  it('sees pictures in Attachments and in an Image field, and none in an empty one', () => {
    const summary = (items: Item[]) => {
      const read = summariseProjectFile(
        projectToEnvelopeText({ id: 'A', name: 'P' }, [tab('t1')], 0, items, WITH_IMAGE),
      );
      return read.ok ? read.summary.pictures : null;
    };
    expect(summary([card('c1', 1, { title: 'a', attachments: [{ id: 'img1' }] as never })])).toBe(
      true,
    );
    expect(summary([card('c1', 1, { title: 'a', 'f-shot': 'img2' })])).toBe(true);
    expect(summary([card('c1', 1, { title: 'a', attachments: [] as never, 'f-shot': '' })])).toBe(
      false,
    );
  });

  it('answers the envelope reader’s refusal', () => {
    expect(summariseProjectFile('not json')).toEqual({ ok: false, failure: 'not_json' });
    expect(summariseProjectFile('{"kind":"liveplanner.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(summariseProjectFile('{"kind":"liveplanner.project","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
  });
});
