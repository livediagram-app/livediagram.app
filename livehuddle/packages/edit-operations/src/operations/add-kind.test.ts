import { describe, expect, it } from 'vitest';
import { getBuiltInTheme, type Element, type Tab } from '@livehuddle/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { parseEditOperations } from '../parse';
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

  it('makes text, stickies and link cards from their factories', () => {
    for (const kind of ['text', 'sticky', 'link-card']) {
      expect(added(`add ${kind}`).type).toBe(kind);
    }
    expect(added('add shape')).toMatchObject({ shape: 'square' });
  });

  it('coerces an unknown kind to a shape with a warning, and refuses what it cannot make', () => {
    const outcome = run('add rectangle label=Box');
    expect(applied(outcome).warnings).toEqual([
      { code: 'shape_coerced', ref: 'box', message: 'box kind "rectangle" drawn as square' },
    ]);
    // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: arrows, lines, drawings, paths
    // and annotations are retired.
    expect(refused(run('add arrow')).details).toEqual([
      'kind="arrow": arrows are no longer supported in livehuddle',
    ]);
    for (const [kind, rule] of [
      ['line', 'lines'],
      ['freehand', 'drawings'],
      ['path', 'paths'],
      ['annotation', 'annotations'],
    ])
      expect(refused(run(`add ${kind}`)).details).toEqual([
        `kind="${kind}": ${rule} are no longer supported in livehuddle`,
      ]);
    expect(refused(run('add image')).code).toBe('invalid_value');
    // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine": tables are retired, as embeds are.
    expect(refused(run('add table')).details).toEqual([
      'kind="table": tables are no longer supported in livehuddle',
    ]);
    expect(refused(run('add square id=n3')).code).toBe('id_taken');
    expect(refused(run('add square colour=red')).code).toBe('unknown_field');
    expect(refused(run('add square below:nope')).code).toBe('target_not_found');
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md: no agent verb makes a Page; a stored one still draws.
  it('makes a square for the Page, as for any kind it does not offer', () => {
    const outcome = run('add page label=Notes');
    expect(applied(outcome).warnings).toEqual([
      { code: 'shape_coerced', ref: 'notes', message: 'notes kind "page" drawn as square' },
    ]);
    expect(added('add page label=Notes')).toMatchObject({ shape: 'square' });
  });

  it("paints with the tab's theme", () => {
    const theme = getBuiltInTheme('forest');
    const el = added('add square label=Themed', { ...checkoutFlow(), theme: 'forest' });
    expect(el).toMatchObject({ fillColor: theme.elementFill, strokeColor: theme.elementStroke });
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: f2 is a stored boundary, a
  // backdrop that holds nothing. A box placed beside one that sits on it lands beside it, on the backdrop, and the
  // backdrop neither grows nor joins it.
  it('places beside a box on a stored boundary, on the backdrop, leaving the boundary as it was', () => {
    const outcome = run('add square label="Gift wrap" right-of:n4');
    const { tab } = applied(outcome);
    const [n4, gift] = ['n4', 'gift-wrap'].map((id) =>
      tab.elements.find((e) => e.id === id),
    ) as (Element & {
      x: number;
      y: number;
      width: number;
      height: number;
    })[];
    expect(gift!.x).toBe(n4!.x + n4!.width + PLACEMENT_GAP);
    expect(gift!.y + gift!.height / 2).toBe(n4!.y + n4!.height / 2);
    expect(tab.elements.find((e) => e.id === 'f2')).toEqual(
      checkoutFlow().elements.find((e) => e.id === 'f2'),
    );
    expect(lines(outcome)).toHaveLength(1);
  });

  it('makes a square for a layout container, as for any kind it does not offer', () => {
    for (const kind of [
      'lane',
      'boundary',
      'stack',
      'card',
      'callout',
      'badge',
      'step',
      'pointer-note',
    ]) {
      const outcome = run(`add ${kind} label=Held`);
      expect(applied(outcome).warnings, kind).toEqual([
        { code: 'shape_coerced', ref: 'held', message: `held kind "${kind}" drawn as square` },
      ]);
      expect(added(`add ${kind} label=Held`), kind).toMatchObject({ shape: 'square' });
    }
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

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: nothing holds, so `inside:` is
  // no placement.
  it('reads inside: as no placement', () => {
    const parseError = (text: string) => {
      const out = parseEditOperations(text);
      return 'errors' in out ? out.errors[0]!.details.join('\n') : '';
    };
    expect(parseError('add square inside:f2')).toMatch(/inside:f2/);
    expect(parseError('add square inside:f2 right-of:n4')).toMatch(/inside:f2/);
    expect(parseError('add square right-of:n4 at:1,2')).toMatch(/one placement/);
    expect(parseError('add square align:n4 align:n3')).toMatch(/one placement/);
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
  it('places them without failing (a 500 in an eval)', () => {
    const outcome = run(
      'add square id=zz label=Zz right-of:n4\nadd square id=yy label=Yy below:zz',
    );
    const { tab } = applied(outcome);
    expect(tab.elements.some((e) => e.id === 'yy')).toBe(true);
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

describe('a placement in the JSON form', () => {
  it('takes alignTo with a side, and no within or inside', async () => {
    const { placementIssue } = await import('../parse-json');
    expect(placementIssue({ rel: 'right-of', ref: 'n4', within: 'f2' })).toMatch(
      /no "within" with "right-of"/,
    );
    expect(placementIssue({ rel: 'inside', ref: 'f2' })).toMatch(/"rel" one of/);
    expect(placementIssue({ rel: 'below', ref: 'f2', alignTo: 'n4' })).toBeNull();
    expect(placementIssue({ rel: 'align', ref: 'n4', alignTo: 'n4' })).toMatch(
      /no "alignTo" with "align"/,
    );
  });
});
