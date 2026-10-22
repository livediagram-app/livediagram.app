import { describe, expect, it } from 'vitest';
import { LIVE_ELEMENT_FIELDS, type Element } from '@liveplanner/project';
import { fieldValue, writeFieldsOnto, type FieldsWrite } from './fields';
import { sprintDashboard } from './fixtures/sprint-dashboard';
import type { Fields } from './types';

const byId = (id: string) => sprintDashboard().elements.find((el) => el.id === id)!;
const write = (el: Element, fields: Fields) => {
  const out = writeFieldsOnto(el, fields, 1);
  if ('code' in out) throw new Error(out.details.join('\n'));
  return out;
};
const refusal = (el: Element, fields: Fields) => {
  const out = writeFieldsOnto(el, fields, 1);
  if (!('code' in out)) throw new Error('expected a refusal');
  return out;
};
const nextOf = (out: FieldsWrite) => out.next as unknown as Record<string, unknown>;

describe('writeFieldsOnto', () => {
  it("writes a Plan element's stored fields, and unsets with null", () => {
    const out = write(byId('w1'), { planView: { view: 'gantt' }, label: null, width: 600 });
    expect(nextOf(out)).toMatchObject({ planView: { view: 'gantt' }, width: 600 });
    expect(nextOf(out)).not.toHaveProperty('label');
    expect(out.written).toEqual(['planView', 'label', 'width']);
  });

  it("writes a chart's look", () => {
    expect(
      nextOf(write(byId('b1'), { chartVariant: 'horizontal', chartAxis: true })),
    ).toMatchObject({
      chartVariant: 'horizontal',
      chartAxis: true,
    });
  });

  it('refuses identity, live and prototype fields, and fields the kind does not take', () => {
    expect(refusal(byId('w1'), { id: 'x' }).details).toEqual(['id="x": cannot be changed']);
    expect(refusal(byId('w1'), { shape: 'square' }).details).toEqual([
      'shape="square": cannot be changed',
    ]);
    expect(refusal(byId('w1'), { [LIVE_ELEMENT_FIELDS[0]]: [] }).hint).toContain('comment');
    expect(refusal(byId('w1'), JSON.parse('{"__proto__": 1}') as Fields).code).toBe(
      'unknown_field',
    );
    // A diagram field a shape stores is not a Plan element's: the list names only what it takes.
    expect(refusal(byId('w1'), { fillColor: '#fff' }).details).toEqual([
      'plan-view has no field "fillColor"',
      'fields: x y width height label locked planView textSize',
    ]);
    expect(refusal(byId('b1'), { planView: { view: 'gantt' } }).details[1]).toBe(
      'fields: x y width height label locked chartSource sheetAnchor chartVariant chartLegend chartValues chartPalette chartAxis',
    );
  });

  it('checks a closed vocabulary and a label', () => {
    expect(refusal(byId('w1'), { textSize: 'xl' }).code).toBe('invalid_value');
    expect(refusal(byId('w1'), { label: 3 }).details).toEqual([
      'label=3: text, in quotes when it has spaces',
    ]);
  });

  it('reads a field as stored', () => {
    expect(fieldValue(byId('w1'), 'planView')).toEqual({ view: 'workload' });
  });
});
