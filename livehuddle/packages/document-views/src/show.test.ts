import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES, type Element } from '@livehuddle/document';
import { shapeAt } from './__fixtures__/build';
import { CHECKOUT_IDS, CHECKOUT_REV, checkoutTab } from './__fixtures__/checkout-tab';
import { golden } from './__fixtures__/golden-path';
import { buildViewModel } from './model';
import { PERSON_ID_FIELDS, showView } from './show';

const checkout = () => buildViewModel(checkoutTab(), { rev: CHECKOUT_REV });
const elementOf = (model: ReturnType<typeof buildViewModel>, id: string) =>
  model.printed.find((el) => el.id === id)!;

describe('showView (R17, VW34)', () => {
  it('prints one element in full with its arrows both ways', async () => {
    const model = checkout();
    const { text, json } = showView(model, elementOf(model, CHECKOUT_IDS.orders));
    await expect(text).toMatchFileSnapshot(golden('checkout.show-146b.txt'));
    expect(json).toMatchObject({
      ref: '146b',
      kind: 'square',
      container: { ref: 'c991', kind: 'frame', label: 'Services' },
      fields: { label: 'Orders service', iconId: 'server', x: 720 },
      omitted: [],
    });
    expect(json.incoming.map((e) => e.ref)).toEqual(['111e']);
    expect(json.outgoing.map((e) => e.ref)).toEqual(['c41d', '892e', '3462']);
    expect(json.fields).not.toHaveProperty('id');
  });

  it("renders a table's cells and a thread, root elements with no container", () => {
    const model = checkout();
    const table = showView(model, elementOf(model, CHECKOUT_IDS.slos)).text.split('\n');
    expect(table).toContain('    | Service | p99 latency | Availability |');
    expect(showView(model, elementOf(model, CHECKOUT_IDS.order)).json.container).toBeNull();
    const sticky = showView(model, elementOf(model, CHECKOUT_IDS.sticky)).text.split('\n');
    expect(sticky).toContain('  comments: open · 2');
    expect(sticky.at(-1)).toBe('  omitted: commentThread.comments[].authorId');
  });

  it('fits a budget by whole lines', () => {
    const model = checkout();
    const { text } = showView(model, elementOf(model, CHECKOUT_IDS.orders), { budget: 60 });
    expect(text.split('\n').at(-1)).toMatch(/^… \d+ lines hidden: view --budget \d+$/);
  });
});

describe('person ids (security)', () => {
  const secret = 'person-secret';
  const assignee = { userId: secret, memberId: secret, name: 'Sam' };
  const action = {
    id: 'a',
    name: 'Do',
    description: '',
    assignee,
    teamId: secret,
    assignerId: secret,
    assignerName: 'Webber',
    status: 'open',
    createdAt: 0,
    updatedAt: 0,
  };
  const comment = {
    id: 'c',
    text: 'hi',
    createdAt: 0,
    authorName: 'Sam',
    authorColor: '#000',
    authorId: secret,
    mentions: [{ userId: secret, memberId: secret, name: 'Pri', handle: 'pri' }],
  };
  const el = {
    ...shapeAt('qa-board', 'q', 0, 0),
    action,
    actions: [action],
    responses: [{ participantId: secret, value: '3', at: 0 }],
    qaNotes: [{ id: 'n', text: 'Q', at: 0, voters: [secret] }],
    commentThread: { comments: [comment], resolved: false },
    addedBy: secret,
  } as unknown as Element;

  it('never leaves through show, in text or JSON, and names every one omitted', () => {
    const model = buildViewModel({ id: 't', name: 'T', elements: [el] });
    const { text, json } = showView(model, el);
    expect(text).not.toContain(secret);
    expect(JSON.stringify(json)).not.toContain(secret);
    expect(json.omitted).toEqual(PERSON_ID_FIELDS);
  });

  it('leaves no top-level field holding an id unaccounted for', () => {
    // An idea card's id is a random UUID per card, never its poster's (docs/specs/012-collaboration/idea-box.md).
    const notPeople = new Set([
      'layerId',
      'iconId',
      'stickerId',
      'imageId',
      'mindParentId',
      // A flowchart's id (its first step's) and a step's lane (docs/specs/009-elements/flowchart.md).
      'flowchartId',
      'flowLaneId',
      'ideaCardIds',
    ]);
    const roots = new Set(PERSON_ID_FIELDS.map((p) => p.split(/[.[{]/)[0]));
    const idLike = Object.values(ELEMENT_FIELD_NAMES)
      .flat()
      .filter((field) => /(Id|Ids|voters|By)$/.test(field));
    for (const field of idLike) expect(notPeople.has(field) || roots.has(field)).toBe(true);
  });
});

describe('show on malformed and mirrored fields', () => {
  it('passes malformed person-id holders through, drops mirrors, and prints resolved threads', () => {
    const el = {
      ...shapeAt('square', 's', 0, 0),
      action: 'junk',
      actions: 'junk',
      responses: [[], 'x'],
      noteRich: [{ text: 'n' }],
      entityFields: [{ type: 'int' }],
      commentThread: {
        comments: [{ id: 'c', text: 'ok', createdAt: 0, authorName: 'A', authorColor: '#000' }],
        resolved: true,
      },
    } as unknown as Element;
    const model = buildViewModel({ id: 't', name: 'T', elements: [el] });
    const { text, json } = showView(model, el);
    expect(json.omitted).toEqual(['noteRich']);
    expect(json.fields).toMatchObject({ action: 'junk', actions: 'junk', responses: [[], 'x'] });
    expect(text).toContain('  fields:\n    -  int\n  comments: resolved · 1');
  });
});
