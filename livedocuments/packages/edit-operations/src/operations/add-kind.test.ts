import { describe, expect, it } from 'vitest';
import { createShape, getBuiltInTheme, type Element, type Tab } from '@livedocuments/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { parseEditOperations } from '../parse';
import type { EditOperation } from '../types';
import { PLACEMENT_GAP } from '../vocabulary';

const run = (text: string, tab: Tab = checkoutFlow()) => {
  const parsed = parseEditOperations(text);
  if ('errors' in parsed) throw new Error(parsed.errors[0]!.details.join('\n'));
  return applyEditOperations(tab, parsed.operations, { makeId: fixedIds() });
};
const added = (text: string, tab?: Tab) => {
  const { tab: next, createdIds } = applied(run(text, tab));
  return next.elements.find((el) => el.id === createdIds.at(-1))!;
};

describe('add <kind>', () => {
  it('sizes a shape like its siblings, gives it a slug id, places it and lists it', () => {
    const outcome = run('add square label="Verify email" below:n3');
    const { tab, createdIds, targets } = applied(outcome);
    const el = tab.elements.find((e) => e.id === 'verify-email')!;
    expect(createdIds).toEqual(['verify-email']);
    expect(targets).toEqual(['n3']);
    expect(el).toMatchObject({
      type: 'shape',
      shape: 'square',
      textSize: 'sm',
      // The checkout flow's squares are 140×60: the new one matches them, not the palette's taller square.
      width: 140,
      height: 60,
    });
    expect(lines(outcome)[0]).toMatch(/^\+ verify-email {2}square "Verify email" @\d+,\d+ 140×60$/);
  });

  it('takes an id, fields and named geometry, which wins over a placement', () => {
    const el = added('add stadium id=done label=Done fill=green x=500 y=900 right-of:n1');
    expect(el).toMatchObject({
      id: 'done',
      shape: 'stadium',
      label: 'Done',
      fillSwatch: 4,
      x: 500,
      y: 900,
    });
    expect(added('add square width=50 height=30 x=1000')).toMatchObject({
      width: 50,
      height: 30,
      x: 1000,
    });
  });

  it('makes text, stickies, tables, annotations and link cards from their factories', () => {
    for (const kind of ['text', 'sticky', 'table', 'annotation', 'link-card']) {
      expect(added(`add ${kind}`).type).toBe(kind);
    }
    expect(added('add shape')).toMatchObject({ shape: 'square' });
  });

  it('coerces an unknown kind to a shape with a warning, and refuses what it cannot make', () => {
    const outcome = run('add rectangle label=Box');
    expect(applied(outcome).warnings).toEqual([
      { code: 'shape_coerced', ref: 'box', message: 'box kind "rectangle" drawn as square' },
    ]);
    expect(refused(run('add arrow')).details).toEqual(['kind="arrow": use connect']);
    expect(refused(run('add image')).code).toBe('invalid_value');
    expect(refused(run('add square id=n3')).code).toBe('id_taken');
    expect(refused(run('add square colour=red')).code).toBe('unknown_field');
    expect(refused(run('add square below:nope')).code).toBe('target_not_found');
  });

  it("paints with the tab's theme", () => {
    const theme = getBuiltInTheme('forest');
    const el = added('add square label=Themed', { ...checkoutFlow(), theme: 'forest' });
    expect(el).toMatchObject({ fillColor: theme.elementFill, strokeColor: theme.elementStroke });
  });

  it('grows the frame of the box it is placed beside, so it joins it instead of landing outside', () => {
    const outcome = run('add square label="Gift wrap" right-of:n4');
    const lineFor = lines(outcome).find((l) => l.startsWith('~ f2'));
    expect(lineFor).toMatch(/widened/);
    expect(lines(outcome)).toContain('f2  +gift-wrap');
  });

  it('takes the template proportions on a tab with no sibling of its shape', () => {
    const empty: Tab = { id: 't', name: 'T', elements: [] };
    const { tab } = applied(run('add square label=Pay', empty));
    expect(tab.elements[0]).toMatchObject({ width: 180, height: 64 });
  });

  it('goes beside the last element the changeset added, then right of the content', () => {
    const outcome = run('add square label=One\nadd square label=Two');
    const { tab } = applied(outcome);
    const [one, two] = ['one', 'two'].map(
      (id) => tab.elements.find((e) => e.id === id) as Element & { x: number },
    );
    expect(one!.x).toBe(310 + PLACEMENT_GAP);
    expect(two!.x).toBe(one!.x + 140 + PLACEMENT_GAP);
  });

  it('takes the layer of its placement reference, or the active one when that is locked', () => {
    const layered = (locked: boolean): Tab => ({
      ...checkoutFlow(),
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'notes', name: 'Notes', ...(locked ? { locked: true } : {}) },
      ],
      elements: checkoutFlow().elements.map((el) =>
        el.id === 'n3' ? { ...el, layerId: 'notes' } : el,
      ),
    });
    expect(added('add sticky below:n3', layered(false)).layerId).toBe('notes');
    expect(added('add sticky below:n3', layered(true)).layerId).toBe('base');
    expect(added('add sticky')).not.toHaveProperty('layerId');
  });

  it('takes inside:<frame> with a side, either order: beside the reference, in that frame', () => {
    for (const text of [
      'add square label="Gift wrap" inside:f2 right-of:n4',
      'add square label="Gift wrap" right-of:n4 inside:f2',
    ]) {
      const outcome = run(text);
      expect(lines(outcome)).toContain('f2  +gift-wrap');
    }
    const parsed = parseEditOperations('add square inside:f2 below:n4 gap:12');
    expect('operations' in parsed ? parsed.operations[0] : null).toMatchObject({
      place: { rel: 'below', ref: 'n4', within: 'f2', gap: 12 },
    });
  });

  it('refuses inside:<frame> with a side whose reference is not in that frame, or a non-frame', () => {
    expect(refused(run('add square inside:f2 right-of:n3')).details?.[0]).toMatch(
      /is not inside f2/,
    );
    expect(refused(run('add square inside:n1 right-of:n4')).details?.[0]).toMatch(
      /not a frame or stack/,
    );
    const parseError = (text: string) => {
      const out = parseEditOperations(text);
      return 'errors' in out ? out.errors[0]!.details[0] : '';
    };
    expect(parseError('add square inside:f2 at:1,2')).toMatch(/one placement/);
    expect(parseError('add square inside:f2 inside:f2')).toMatch(/one placement/);
  });

  it('places beside a frame, centred on a member with align:, outside the frame', () => {
    const { tab } = applied(run('add square label=Store below:f2 align:n4'));
    const store = tab.elements.find((e) => e.id === 'store') as Element & {
      x: number;
      y: number;
      width: number;
    };
    const [n4, f2] = ['n4', 'f2'].map((id) => tab.elements.find((e) => e.id === id)) as (Element & {
      x: number;
      y: number;
      width: number;
      height: number;
    })[];
    expect(store.x + store.width / 2).toBe(n4!.x + n4!.width / 2);
    expect(store.y).toBeGreaterThanOrEqual(f2!.y + f2!.height);
    const parsed = parseEditOperations('add square align:n4 below:f2');
    expect('operations' in parsed ? parsed.operations[0] : null).toMatchObject({
      place: { rel: 'below', ref: 'f2', alignTo: 'n4' },
    });
  });

  it('grows a full container it goes inside, moving what sat under it on (EO27)', () => {
    const outcome = run('add square label=Retry inside:f2');
    const f2 = applied(outcome).tab.elements.find((e) => e.id === 'f2') as Element & {
      height: number;
    };
    expect(f2.height).toBeGreaterThan(200);
    expect(lines(outcome)).toEqual([
      expect.stringMatching(/^\+ retry {2}square "Retry" @/),
      expect.stringMatching(/^~ f2 {2}taller 200→\d+$/),
      // The steps under the frame move down by the growth rather than being taken in.
      '» n6 n7 n8 t1  +0,+162 (make room)',
      'f2  +retry',
    ]);
  });

  it('leaves a locked container ungrown', () => {
    const tab = {
      ...checkoutFlow(),
      elements: checkoutFlow().elements.map((el) =>
        el.id === 'f2' ? { ...el, locked: true } : el,
      ),
    };
    const f2 = applied(run('add square inside:f2', tab)).tab.elements.find(
      (e) => e.id === 'f2',
    ) as Element & { height: number };
    expect(f2.height).toBe(200);
  });

  it('refuses a kind on a locked layer it would land on', () => {
    const op: EditOperation = { op: 'add', kind: 'square', fields: { layerId: 'shut' } };
    const tab: Tab = { ...checkoutFlow(), layers: [{ id: 'shut', name: 'Shut', locked: true }] };
    expect(refused(applyEditOperations(tab, [op], { makeId: fixedIds() })).code).toBe(
      'element_locked',
    );
  });

  it('keeps a given md text size on a tab with no sibling, and reads a size the template sizes for', () => {
    const empty: Tab = { id: 't', name: 'T', elements: [] };
    expect(applied(run('add square label=Pay text=md', empty)).tab.elements[0]).toMatchObject({
      textSize: 'md',
    });
    expect(applied(run('add square label=Pay text=lg', empty)).tab.elements[0]).toMatchObject({
      textSize: 'lg',
    });
  });

  it('matches the size most siblings use when they differ', () => {
    const tab = checkoutFlow();
    const mixed: Tab = {
      ...tab,
      elements: tab.elements.map((el) => (el.id === 'n2' ? { ...el, textSize: 'md' } : el)),
    };
    const { tab: next } = applied(run('add square label="Gift wrap" below:n8', mixed));
    expect(next.elements.find((e) => e.id === 'gift-wrap')).toMatchObject({ textSize: 'sm' });
  });

  it('leaves frames alone when placed by coordinates or beside an arrow', () => {
    for (const op of ['add square label=Far x=4000 y=4000', 'add square label=Near below:a3']) {
      const outcome = run(op);
      if ('errors' in outcome) continue;
      expect(lines(outcome).some((l) => l.startsWith('~ f2'))).toBe(false);
    }
  });

  it('widens a frame without making it taller when the new box fits its height', () => {
    const outcome = run('add square label=Side right-of:n4 height=30');
    const grown = lines(outcome).find((l) => l.startsWith('~ f2'));
    expect(grown).toMatch(/widened/);
    expect(grown).not.toMatch(/taller/);
  });

  it('places a box beside a framed one in the frame, moving what lay past the frame on', () => {
    const outcome = run('add square label=Below below:n5 width=100');
    const { tab } = applied(outcome);
    const n5 = tab.elements.find((e) => e.id === 'n5') as Element & { y: number; height: number };
    const below = tab.elements.find((e) => e.id === 'below') as Element & { y: number };
    expect(below.y).toBe(n5.y + n5.height + PLACEMENT_GAP);
    expect(lines(outcome)).toContain('» n6 n7 n8 t1  +0,+222 (make room)');
    expect(lines(outcome)).toContain('f2  +below');
  });

  it('makes room on whichever side the box goes, and grows without making room along the flow', () => {
    for (const op of [
      'add square label=L left-of:n4',
      'add square label=A above:n4',
      'add square label=F after:n4',
    ]) {
      const outcome = run(op);
      expect(lines(outcome).some((l) => l.startsWith('~ f2'))).toBe(true);
    }
  });

  it('widens a frame across the flow for a box wider than it, placed below a member', () => {
    const grown = lines(run('add square label=Wide below:n5 width=600')).find((l) =>
      l.startsWith('~ f2'),
    );
    expect(grown).toMatch(/widened/);
    expect(grown).toMatch(/taller/);
  });

  it('leaves a frame as it is when the new box already fits inside it', () => {
    const tab = checkoutFlow();
    const roomy: Tab = {
      ...tab,
      elements: tab.elements.map((el) =>
        el.id === 'f2' && el.type === 'shape' ? { ...el, height: el.height + 600 } : el,
      ),
    };
    const outcome = run('add square label=Below below:n5 width=100', roomy);
    expect(lines(outcome).some((l) => l.startsWith('~ f2'))).toBe(false);
  });

  it('grows an empty container it goes inside on its own, with nothing to make room against', () => {
    const empty: Tab = {
      id: 't',
      name: 'T',
      elements: [{ ...createShape('frame', 0, 0), id: 'f', width: 200, height: 40 }],
    };
    const f = applied(run('add square label=One inside:f', empty)).tab.elements.find(
      (e) => e.id === 'f',
    ) as Element & { height: number };
    expect(f.height).toBeGreaterThan(40);
  });

  it('makes a frame taller without widening it when the new box fits its width', () => {
    const outcome = run('add square label=Below below:n5 width=100');
    const grown = lines(outcome).find((l) => l.startsWith('~ f2'));
    expect(grown).toMatch(/taller/);
    expect(grown).not.toMatch(/widened/);
  });
});

describe('add <kind> beside template-look siblings', () => {
  const sq = (id: string, x: number, textSize: string): Element =>
    ({
      id,
      type: 'shape',
      shape: 'square',
      x,
      y: 0,
      width: 236,
      height: 66,
      label: id,
      textSize,
    }) as Element;
  it('takes their size, not the palette square, whatever their text size', () => {
    for (const textSize of ['md', 'lg']) {
      const tab: Tab = {
        id: 't',
        name: 'T',
        elements: [sq('a', 0, textSize), sq('b', 300, textSize)],
      };
      const el = applied(
        run(
          `add square label="Search service"${textSize === 'md' ? ' iconId=search' : ''} right-of:b`,
          tab,
        ),
      ).tab.elements.find((e) => e.id === 'search-service');
      // Their height; their width, or wider where a label with its icon needs it.
      expect(el).toMatchObject({ height: 66 });
      expect((el as Element & { width: number }).width).toBeGreaterThanOrEqual(236);
    }
  });

  it('measures a new box at its own text size, with no sibling to match', () => {
    const tab: Tab = { id: 't', name: 'T', elements: [] };
    const at = (size: string) =>
      added(`add square label="Search service" textSize=${size}`, tab) as Element & {
        width: number;
      };
    expect(at('lg').width).toBeGreaterThan(at('sm').width);
  });

  it('matches siblings taller than the palette box of their shape', () => {
    const tall = (id: string, x: number): Element => ({
      id,
      type: 'shape',
      shape: 'square',
      x,
      y: 0,
      width: 160,
      height: 180,
      label: id,
      textSize: 'sm',
    });
    const tab: Tab = { id: 't', name: 'T', elements: [tall('a', 0), tall('b', 300)] };
    const el = applied(run('add square label=Next right-of:b', tab)).tab.elements.find(
      (e) => e.id === 'next',
    );
    expect(el).toMatchObject({ width: 160, height: 180 });
  });
});

describe('add <kind> beside a framed box with no arrow', () => {
  it('grows the frame and makes room without failing (a 500 in an eval)', () => {
    const outcome = run(
      'add square id=zz label=Zz right-of:n4\nadd square id=yy label=Yy below:zz',
    );
    const { tab } = applied(outcome);
    expect(tab.elements.some((e) => e.id === 'yy')).toBe(true);
    expect(lines(outcome)).toContain('f2  +zz +yy');
  });
});

describe('a frame grown to hold a new box', () => {
  it('grows left past a member, moving what lay left of it on', () => {
    const tab = checkoutFlow();
    const west = {
      id: 'west',
      type: 'shape',
      shape: 'square',
      x: -260,
      y: 320,
      width: 100,
      height: 60,
      label: 'West',
    } as Element;
    const outcome = run('add square label=Side left-of:n4', {
      ...tab,
      elements: [...tab.elements, west],
    });
    const grown = lines(outcome).find((l) => l.startsWith('~ f2'));
    expect(grown).toMatch(/widened/);
    const moved = applied(outcome).tab.elements.find((e) => e.id === 'west') as Element & {
      x: number;
    };
    expect(moved.x).toBeLessThan(-260);
  });

  it('grows the frame the grown one sits in, so it still holds it', () => {
    const tab: Tab = {
      id: 't',
      name: 't',
      elements: [
        { ...createShape('frame', 0, 0), id: 'outer', width: 400, height: 300, label: '' },
        { ...createShape('frame', 40, 40), id: 'inner', width: 220, height: 160, label: '' },
        { ...createShape('square', 60, 80), id: 'm', width: 140, height: 60, label: 'M' },
      ] as Element[],
    };
    const { tab: next } = applied(run('add square label=N right-of:m', tab));
    const box = (id: string) =>
      next.elements.find((e) => e.id === id) as Element & {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    const [outer, inner] = [box('outer'), box('inner')];
    expect(inner.x + inner.width).toBeGreaterThan(400);
    expect(outer.x + outer.width).toBeGreaterThan(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThanOrEqual(inner.y + inner.height);
  });

  it('keeps a locked element where it is when what holds it moves on', () => {
    const tab = checkoutFlow();
    const below: Element[] = [
      { ...createShape('frame', 0, 900), id: 'g', width: 400, height: 200, label: '' },
      {
        id: 'pinned-note',
        type: 'shape',
        shape: 'square',
        x: 40,
        y: 940,
        width: 100,
        height: 60,
        label: 'Kept',
        locked: true,
      },
    ];
    const outcome = run('add square label=Retry inside:f2', {
      ...tab,
      elements: [...tab.elements, ...below],
    });
    const after = applied(outcome).tab.elements;
    expect((after.find((e) => e.id === 'pinned-note') as Element & { y: number }).y).toBe(940);
    expect((after.find((e) => e.id === 'g') as Element & { y: number }).y).toBeGreaterThan(900);
  });
});

describe('add <kind> with icon=', () => {
  it('reads icon as the stored iconId, as graph input names it', () => {
    const el = applied(run('add square label=Search icon=search right-of:n8')).tab.elements.find(
      (e) => e.id === 'search',
    );
    expect(el).toMatchObject({ iconId: 'search' });
    expect(el).not.toHaveProperty('icon');
  });
});

describe('within in the JSON form', () => {
  it('reads "within" with a side and refuses it with inside or as a non-selector', async () => {
    const { placementIssue } = await import('../parse-json');
    expect(placementIssue({ rel: 'right-of', ref: 'n4', within: 'f2' })).toBeNull();
    expect(placementIssue({ rel: 'inside', ref: 'f2', within: 'f2' })).toMatch(
      /no "within" with "inside"/,
    );
    expect(placementIssue({ rel: 'below', ref: 'f2', alignTo: 'n4' })).toBeNull();
    expect(placementIssue({ rel: 'align', ref: 'n4', alignTo: 'n4' })).toMatch(
      /no "alignTo" with "align"/,
    );
    expect(placementIssue({ rel: 'right-of', ref: 'n4', within: '' })).toMatch(
      /"within" a non-empty selector/,
    );
  });
});
