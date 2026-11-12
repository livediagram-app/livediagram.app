// The type editor's Display sample (ItemTypeDisplay): a card of the type with something in every field, its
// custom fields' sample values by kind, and its open comments, so each placed field shows on the preview.
import {
  COMMENTS_FIELD,
  commentsFieldsOf,
  fromLocalInput,
  STATUS_SINCE_FIELD,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { fieldCountKey } from '@liveplanner/project';
import { createThreadStore, type ThreadStore } from '@/hooks/plan/thread-store';
import { dayKey } from './day-label';

const SAMPLE_PERSON = { id: 'sample-person', name: 'Sam Rivera', color: '#0d9488' };
const SAMPLE_REVIEWER = { id: 'sample-reviewer', name: 'Ana Silva', color: '#7c3aed' };

// A card with something in every field, so each placed field shows.
export function sampleCard(type: ItemTypeDef): Item {
  return {
    id: 'sample-card',
    type: type.id,
    key: 12,
    rank: 'a',
    fields: {
      title: `Example ${type.label || 'card'}`,
      assignee: SAMPLE_PERSON,
      priority: 'high',
      due: dayKey(3),
      start: dayKey(-2),
      // Four days in its column, so a placed Age reads "4d".
      status: 'In Progress',
      [STATUS_SINCE_FIELD]: Date.now() - 4 * 86_400_000,
      labels: ['Design'],
      estimate: 3,
      checklist: [
        { id: 'a', text: 'One', done: true },
        { id: 'b', text: 'Two', done: true },
        { id: 'c', text: 'Three', done: false },
        { id: 'd', text: 'Four', done: false },
        { id: 'e', text: 'Five', done: false },
      ],
      description: 'A short description of the work, as its first lines read on a card.',
      votes: { 'sample-person': 3 },
      comments: { comments: [{}, {}] },
      // Three pictures, so the Attachments chip reads 3; the cover draws as its placeholder (CardCover's `sample`).
      attachments: ['a', 'b', 'c'].map((n) => ({
        id: `sample-${n}`,
        name: `${n}.png`,
        size: 1024,
        type: 'image/png',
      })),
      // A sample value for each of the type's custom fields, so a placed one shows.
      ...Object.fromEntries((type.custom ?? []).flatMap((c) => sampleCustom(c))),
    },
    rev: 1,
    // Made two days ago and edited today, so placed stamps read as a real card's.
    createdAt: Date.now() - 2 * 86_400_000,
    updatedAt: Date.now(),
    createdBy: SAMPLE_PERSON,
    updatedBy: SAMPLE_PERSON,
  };
}

// The sample's open comments: two in each of the type's Comments fields, so each placed one's chip shows.
export function sampleThreadStore(type: ItemTypeDef, itemId: string): ThreadStore {
  const fields = commentsFieldsOf(type);
  const store = createThreadStore();
  store.setCounts(
    new Map([
      [itemId, 2 * fields.length],
      ...fields
        .filter((f) => f !== COMMENTS_FIELD)
        .map((f) => [fieldCountKey(itemId, f), 2] as const),
    ]),
  );
  return store;
}

// A custom field's sample value, by its kind (none for a Link to Card: the chip then reads its name).
function sampleCustom(c: CustomFieldDef): [string, unknown][] {
  switch (c.kind) {
    case 'number':
      return [[c.id, 5]];
    case 'date':
      return [[c.id, dayKey(7)]];
    // A week away at 17:00 in the viewer's zone; a range of that day to two days later, 09:00 to 17:00 with times.
    case 'datetime':
      return [[c.id, fromLocalInput(`${dayKey(7)}T17:00`) ?? dayKey(7)]];
    case 'daterange':
      return [
        [
          c.id,
          c.withTime
            ? [fromLocalInput(`${dayKey(7)}T09:00`), fromLocalInput(`${dayKey(9)}T17:00`)]
            : [dayKey(7), dayKey(9)],
        ],
      ];
    case 'phone':
      return [[c.id, '+44 20 7946 0958']];
    case 'checkbox':
      return [[c.id, true]];
    case 'link':
      return [[c.id, 'https://example.com']];
    case 'pullrequest':
      return [[c.id, 'https://github.com/acme/web/pull/42']];
    case 'currency':
      return [[c.id, 12500]];
    case 'percent':
      return [[c.id, 40]];
    // 2h 30m; a Time Spent field as one entry of it (docs/specs/026-plan/item-types.md "Duration").
    case 'duration':
      return [
        [
          c.id,
          c.timeSpent
            ? {
                people: { sample: { name: 'Sam', color: '#7c3aed' } },
                entries: [{ id: 'sample-entry', by: 'sample', minutes: 150, at: 0 }],
                running: [],
              }
            : 150,
        ],
      ];
    case 'email':
      return [[c.id, 'sam@example.com']];
    case 'choice':
      return c.options?.[0] ? [[c.id, c.options[0]]] : [];
    // A built-in kind's sample is its built-in field's; an Image has none to fetch, so it reads its name, and a
    // Comments field's chip counts the sample's threads (sampleThreadStore).
    case 'person':
      return [[c.id, SAMPLE_REVIEWER]];
    case 'labels':
      return [[c.id, ['Urgent']]];
    case 'colour':
      return [[c.id, '#0d9488']];
    case 'checklist':
      return [
        [
          c.id,
          [
            { id: 'a', text: 'One', done: true },
            { id: 'b', text: 'Two', done: false },
          ],
        ],
      ];
    // A Votes field reads its ▲ count, as the built-in Votes' sample does.
    case 'votes':
      return [[c.id, { 'sample-person': 2 }]];
    case 'card':
    case 'image':
    case 'comments':
      return [];
    default:
      return [[c.id, c.label || 'Sample']];
  }
}
