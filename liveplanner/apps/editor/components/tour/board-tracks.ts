// The missions of a board's Card Types and Board Setup tracks (docs/specs/026-plan/plan-tour.md "Boards: Card Types",
// "Boards: Board Setup"). Unlike the Practice Sprint these change the real plan (a type, the board's setup), checked
// against how it was when the track started; the finish keeps the changes or puts them back.
// The telemetry dashboard reads the `id: '…'` lines below for the mission views it expects (computed-emitters.ts).

import type { Item, ItemTypeDef, PlanBoardSetup } from '@liveplanner/items';
import { widgetsOf } from '@liveplanner/items';
import type { Mission } from './missions';
import { boardRoot } from './plan-tour-steps';

// ---------------------------------------------------------------- Card Types

export type TypesCtx = {
  // The plan's card types as the track started, and now.
  startIds: ReadonlySet<string>;
  types: readonly ItemTypeDef[];
  // The new type's fields as it was first saved, so an edit is told apart.
  firstShape: string | null;
  // The practice cards on the board (a card added during the track is one).
  practice: readonly Item[];
};

// The type the person made during the track, if any.
export const newTypeOf = (c: Pick<TypesCtx, 'startIds' | 'types'>): ItemTypeDef | undefined =>
  c.types.find((t) => !c.startIds.has(t.id));

// A type's fields, as one string to compare.
export const typeShape = (t: ItemTypeDef): string => JSON.stringify([t.fields, t.custom ?? []]);

const TYPES_BUTTON = '[data-tour-id="card-types"]';

export function typesMissions(boardId: string, firstName: string): Mission<TypesCtx>[] {
  return [
    {
      id: 'make-type',
      title: 'Make a Card Type',
      why: 'Open **Types** and add one: a Risk, a Bug, a Request.',
      // Types, then its Add Card Type, then the editor's name, then Save once it has one.
      points: [
        '[data-tour-id="card-type-save"]:not(:disabled)',
        '[data-tour-id="card-type-general"] input',
        '[data-add-card-type]',
        TYPES_BUTTON,
      ],
      lesson: 'A type is a kind of card, with its own colour, glyph and fields.',
      hints: [
        { text: 'Press Types, bottom right, then Add Card Type.', ring: () => TYPES_BUTTON },
        {
          text: 'Name it here, pick a colour, then Save.',
          ring: () => '[data-tour-id="card-type-general"] input',
        },
      ],
      done: (c) => newTypeOf(c) !== undefined,
    },
    {
      id: 'edit-type',
      title: 'Give It a Field',
      why: 'Open your new type from **Types** and press **Add Field**, then save.',
      points: ['[data-tour-id="card-type-fields"] [data-add-field]', TYPES_BUTTON],
      lesson: 'Every card of the type gets the field, ready to fill in.',
      hints: [
        { text: 'In Types, press your new type to edit it.', ring: () => TYPES_BUTTON },
        {
          text: 'Add Field is here. Save when you are done.',
          ring: () => '[data-tour-id="card-type-fields"] [data-add-field]',
        },
      ],
      done: (c) => {
        const made = newTypeOf(c);
        return !!made && c.firstShape !== null && typeShape(made) !== c.firstShape;
      },
    },
    {
      id: 'use-type',
      onPage: true,
      title: 'Add One to the Board',
      why: `Press **Add card** in ${firstName} and pick your new type.`,
      points: [`${boardRoot(boardId)} [data-add-card-trigger]`],
      lesson: 'The board takes it like any other. This card is practice, so it goes when you finish.',
      hints: [
        { text: `Add card sits at the foot of ${firstName}.` },
        {
          text: 'This one.',
          ring: () => `${boardRoot(boardId)} [data-add-card-trigger]`,
        },
      ],
      done: (c) => {
        const made = newTypeOf(c);
        return !!made && c.practice.some((i) => i.type === made.id);
      },
    },
  ];
}

// ---------------------------------------------------------------- Board Setup

export type SetupCtx = { start: PlanBoardSetup; now: PlanBoardSetup };

const startColumn = (c: SetupCtx, id: string) => c.start.columns.find((col) => col.id === id);

export function setupMissions(boardId: string): Mission<SetupCtx>[] {
  return [
    {
      id: 'rename-column',
      title: 'Rename a Column',
      why: 'Open a column’s **settings** and give it a new **Column Name**.',
      points: ['[aria-label="Column name"]', `${boardRoot(boardId)} [aria-label$=" column settings"]`],
      lesson: 'Name columns after how your team really works: the cards keep their place.',
      hints: [
        { text: 'Hover a column’s header for its cog, then edit Column Name.' },
        { text: 'This cog.', ring: () => `${boardRoot(boardId)} [aria-label$=" column settings"]` },
      ],
      done: (c) =>
        c.now.columns.some((col) => {
          const was = startColumn(c, col.id);
          return !!was && was.name !== col.name;
        }),
    },
    {
      id: 'set-wip',
      title: 'Set a WIP Limit',
      why: 'In a column’s **settings**, raise its **WIP Limit**.',
      points: [
        'button[aria-label="Raise the WIP limit"]',
        `${boardRoot(boardId)} [aria-label$=" column settings"]`,
      ],
      lesson: 'Over its limit, a column’s count turns amber: finish something before starting more.',
      hints: [
        { text: 'Open a column’s cog and raise its WIP Limit.' },
        { text: 'Here.', ring: () => '[id^="column-"][id$="-wip"]' },
      ],
      done: (c) =>
        c.now.columns.some((col) => {
          const was = startColumn(c, col.id);
          return !!was && was.wipLimit !== col.wipLimit;
        }),
    },
    {
      id: 'add-widget',
      title: 'Add a Widget',
      why: 'Press **+** in the board’s header and pick a widget, such as Only Mine.',
      points: [`${boardRoot(boardId)} button[aria-label="Add a widget"]`],
      lesson: 'Widgets count, filter and sum this board’s cards, live as they move.',
      hints: [
        { text: 'Press + at the end of the header’s widgets and pick one.' },
        { text: 'This +.', ring: () => `${boardRoot(boardId)} button[aria-label="Add a widget"]` },
      ],
      done: (c) => {
        const had = new Set(widgetsOf(c.start));
        return widgetsOf(c.now).some((w) => !had.has(w));
      },
    },
  ];
}

// Whether the board's setup changed during the track (Put It Back has something to do).
export const setupChanged = (start: PlanBoardSetup, now: PlanBoardSetup): boolean =>
  JSON.stringify(start) !== JSON.stringify(now);
