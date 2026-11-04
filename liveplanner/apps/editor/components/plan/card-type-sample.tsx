// A card type's example card and its fields' names and icons (docs/specs/026-plan/item-types.md "Editing a type":
// Display; docs/specs/026-plan/plan-overview.md "Card Types"): shared by the type editor's Display and the Overview's
// card type tiles, so a type's example reads the same in both.
import {
  STATUS_SINCE_FIELD,
  fromLocalInput,
  isCustomCardField,
  type CardField,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideImage } from '@liveworkspace/icons/lucide';
import { CARD_FIELD_LABELS } from './board-setup-edits';
import { FIELD_GLYPHS } from './card-field-glyphs';
import { customFieldIcon } from './CustomFieldKindParts';
import { dayKey } from './day-label';
import { PlanTypeGlyph } from './plan-type-glyph';

const PicturesGlyph = lucideGlyph(lucideImage, 14);

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

// A field's name and icon: a built-in's own, or a custom field's (its label, its kind's icon).
const customOf = (type: ItemTypeDef, f: CardField) =>
  isCustomCardField(f) ? (type.custom ?? []).find((c) => c.id === f) : undefined;
export const fieldLabel = (type: ItemTypeDef, f: CardField) =>
  customOf(type, f)?.label || (isCustomCardField(f) ? 'Custom Field' : CARD_FIELD_LABELS[f]);
export const fieldIcon = (type: ItemTypeDef, f: CardField, size = 14) => {
  const custom = customOf(type, f);
  if (custom)
    return (
      <span className="flex" style={{ width: size, height: size }}>
        <span className="flex [&_svg]:h-full [&_svg]:w-full">{customFieldIcon(custom)}</span>
      </span>
    );
  // Attachments draws its picture glyph, as on the card.
  if (f === 'attachments')
    return (
      <span className="flex [&_svg]:h-full [&_svg]:w-full" style={{ width: size, height: size }}>
        <PicturesGlyph />
      </span>
    );
  return f === 'key' ? (
    <span className="text-[12px] font-semibold leading-none">#</span>
  ) : (
    <PlanTypeGlyph glyph={FIELD_GLYPHS[f as keyof typeof FIELD_GLYPHS] ?? 'note'} size={size} />
  );
};
