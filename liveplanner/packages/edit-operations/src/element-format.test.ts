import { describe, expect, it } from 'vitest';
import { ELEMENT_FIELD_NAMES } from '@liveplanner/project';
import { estimateTokens } from '@liveplanner/project-views';
import {
  addableKinds,
  elementFormatText,
  elementKindsText,
  SCHEMA_KIND_MAX_TOKENS,
} from './element-format';
import { PLAN_COMMON_FIELDS, PLAN_KIND_FIELDS } from './plan-elements';
import { parseEditOperations } from './parse';

describe('the element format', () => {
  it('lists the kinds a Plan tab holds, and no diagram kind', () => {
    const text = elementKindsText();
    expect(addableKinds()).toEqual([
      'plan-board',
      'plan-sheet',
      'plan-view',
      'bar-chart',
      'line-chart',
      'pie-chart',
    ]);
    for (const kind of addableKinds()) expect(text).toContain(`  ${kind}: `);
    for (const word of ['sticky', 'arrow', 'sankey', 'square', 'connect'])
      expect(text).not.toContain(word);
  });

  it('keeps every kind within its budget', () => {
    for (const kind of addableKinds())
      expect(estimateTokens(elementFormatText(kind)!), kind).toBeLessThanOrEqual(
        SCHEMA_KIND_MAX_TOKENS,
      );
  });

  it("gives a kind its add form and its own fields, a closed field's values included", () => {
    const view = elementFormatText('plan-view')!;
    expect(view).toMatch(/^plan-view: a Dashboard's metric or chart/);
    expect(view).toContain('{"op":"add","element":{"type":"shape","shape":"plan-view",…}}');
    expect(view).toContain('planView textSize (sm|md|lg');
    expect(view).toContain('x y width height label locked');
    expect(elementFormatText('bar-chart')).toContain('chartSource { "sheetId", "range" }');
  });

  it('knows nothing of a kind no tab holds', () => {
    for (const kind of ['rectangle', 'square', 'sticky', 'arrow', 'sankey'])
      expect(elementFormatText(kind)).toBeNull();
  });

  it('names only stored shape fields, so the lists cannot drift', () => {
    const stored = new Set<string>(ELEMENT_FIELD_NAMES.shape);
    for (const field of [...PLAN_COMMON_FIELDS, ...Object.values(PLAN_KIND_FIELDS).flat()])
      expect(stored.has(field), field).toBe(true);
  });

  it('teaches an add form the parser reads', () => {
    const line = '{"op":"add","element":{"type":"shape","shape":"plan-view"}}';
    expect(parseEditOperations(line)).toHaveProperty('operations');
  });
});
