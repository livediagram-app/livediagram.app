import { describe, expect, it } from 'vitest';
import { getBuiltInTheme, labelBoxSize, type Element, type Tab } from '@livediagram/document';
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
  it('sizes a shape for its label, gives it a slug id, places it and lists it', () => {
    const outcome = run('add square label="Verify email" below:n3');
    const { tab, createdIds, targets } = applied(outcome);
    const el = tab.elements.find((e) => e.id === 'verify-email')!;
    expect(createdIds).toEqual(['verify-email']);
    expect(targets).toEqual(['n3']);
    expect(el).toMatchObject({
      type: 'shape',
      shape: 'square',
      textSize: 'sm',
      ...labelBoxSize('Verify email', 'square'),
    });
    expect(lines(outcome)[0]).toMatch(
      /^\+ verify-email {2}square "Verify email" @\d+,\d+ 131×120$/,
    );
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

  it('goes beside the last element the changeset added, then right of the content', () => {
    const outcome = run('add square label=One\nadd square label=Two');
    const { tab } = applied(outcome);
    const [one, two] = ['one', 'two'].map(
      (id) => tab.elements.find((e) => e.id === id) as Element & { x: number },
    );
    expect(one!.x).toBe(310 + PLACEMENT_GAP);
    expect(two!.x).toBe(one!.x + 120 + PLACEMENT_GAP);
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

  it('grows a full container it goes inside, reporting everything it now holds (EO27)', () => {
    const outcome = run('add square label=Retry inside:f2');
    const f2 = applied(outcome).tab.elements.find((e) => e.id === 'f2') as Element & {
      height: number;
    };
    expect(f2.height).toBeGreaterThan(200);
    expect(lines(outcome)).toEqual([
      expect.stringMatching(/^\+ retry {2}square "Retry" @/),
      expect.stringMatching(/^~ f2 {2}taller 200→\d+$/),
      // Growing below the lowest member also takes in the steps under the frame; the line says so.
      'f2  +n6 +n7 +retry',
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
});
