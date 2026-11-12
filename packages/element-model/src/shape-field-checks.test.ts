import { describe, expect, it } from 'vitest';
import type { FieldCheck } from '@liveworkspace/model-core/validate-primitives';
import { ATTACH_POINTS } from './attachment';
import { CHART_PALETTES } from './chart-palettes';
import { CHIP_LOOKS } from './chip';
import {
  ATTACH_POINTS_RULE,
  BOUNDARY_CHECK,
  CARD_CHECKS,
  CHART_LOOK_CHECKS,
  CHART_PALETTE_IDS_RULE,
  CHECKLIST_CHECK,
  CHIP_LOOKS_RULE,
  CODE_CHECKS,
  CONCEPT_CHECKS,
  DIAGRAM_KEY_CHECKS,
  ENTITY_FIELDS_CHECK,
  FLOWCHART_CHECKS,
  LEGEND_CHECK,
  MIND_FLOW_CHECKS,
  MIND_LOOK_CHECK,
  POINTER_TIP_CHECK,
  SANKEY_CHECKS,
  SEQUENCE_CHECKS,
  STACK_CHECKS,
  STATS_CHECK,
  TAGS_CHECK,
  WEB_LIST_CHECKS,
  chartRowChecks,
  dataArray,
  finite,
  flag,
  isOptionalStrUpTo,
  oneOf,
  shapeIssue,
} from './shape-field-checks';

const CHECKS: readonly FieldCheck[] = [
  ...chartRowChecks(),
  ...CODE_CHECKS,
  ...MIND_FLOW_CHECKS,
  ...CHART_LOOK_CHECKS,
  ...FLOWCHART_CHECKS,
  ...CARD_CHECKS,
  POINTER_TIP_CHECK,
  MIND_LOOK_CHECK,
  ...STACK_CHECKS,
  ...DIAGRAM_KEY_CHECKS,
  ...SEQUENCE_CHECKS,
  BOUNDARY_CHECK,
  ...CONCEPT_CHECKS,
  TAGS_CHECK,
  ENTITY_FIELDS_CHECK,
  STATS_CHECK,
  ...WEB_LIST_CHECKS,
  CHECKLIST_CHECK,
  LEGEND_CHECK,
  ...SANKEY_CHECKS,
];

const check = (el: Record<string, unknown>) => shapeIssue({ shape: 'rectangle', ...el }, CHECKS);

// A value each field takes, so a test can prove the check passes it.
const GOOD: Record<string, unknown> = {
  railLabels: ['a'],
  lineCategories: ['Q1'],
  pieSlices: [{ label: 'a', value: 1 }],
  lineSeries: [{ name: 'a', values: [1] }],
  code: 'x',
  codeLanguage: 'ts',
  mindFlow: 'tree',
  chartVariant: 'area',
  chartPalette: 'vivid',
  embedProvider: 'youtube',
  mindParentId: '',
  flowchartId: 'f',
  flowDirection: 'down',
  flowLaneId: 'l',
  pageTitle: 'Title',
  cardMedia: 'tile',
  cardHeader: true,
  chipLook: 'solid',
  attachedTo: 'a',
  attachAt: 'top',
  pointerTip: { x: 1, y: 2 },
  mindLook: 'person',
  stackDirection: 'grid',
  stackAlign: 'end',
  stackGap: 64,
  stackPadding: 0,
  stackColumns: 6,
  keyRows: [{ id: 'r', kind: 'tag', tag: 't' }],
  keyMeanings: { r: 'Meaning' },
  sequenceParticipants: [
    { id: 'a', label: 'A', actor: true },
    { id: 'b', label: 'B' },
  ],
  sequenceMessages: [{ from: 'a', to: 'b', label: 'hi', kind: 'reply' }],
  sequenceNumbered: false,
  boundaryStyle: 'c4',
  conceptRows: [{ label: 'a', note: 'b' }],
  pyramidVariant: 'funnel',
  tags: ['t'],
  entityFields: [{ name: 'id', type: 'int', key: 'pk' }],
  stats: [{ value: '1', caption: 'c' }],
  processSteps: ['a'],
  navLinks: ['a'],
  checklistItems: [{ text: 'a', done: true }],
  legendItems: [{ label: 'a', color: '#fff' }],
  sankeyFlows: [{ from: 'a', to: 'b', value: -1 }],
  sankeyNodes: [{ name: 'a', color: '#fff', leftover: false }],
  sankeyUnit: 'kg',
  sankeyLeftoverName: 'Other',
  sankeyAnimRepeat: true,
};

describe('shape field checks', () => {
  it('passes a shape with no fields, and refuses one with no kind', () => {
    expect(check({})).toBeNull();
    expect(shapeIssue({}, CHECKS)).toEqual({ field: 'shape', rule: 'a shape kind' });
  });

  it('passes every field a good value', () => {
    expect(check(GOOD)).toBeNull();
  });

  it('refuses a malformed value of every field, naming it', () => {
    for (const { field } of CHECKS) {
      expect(check({ [field]: Symbol('bad') })?.field, field).toBe(field);
    }
  });

  it('refuses rows past their bounds and malformed rows', () => {
    expect(check({ sequenceParticipants: [{ id: 'a', label: 'A' }] })?.field).toBe(
      'sequenceParticipants',
    );
    expect(
      check({
        keyMeanings: Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, 'm'])),
      })?.field,
    ).toBe('keyMeanings');
    expect(check({ entityFields: [{ name: 'id', key: 'nope' }] })?.field).toBe('entityFields');
    expect(check({ sankeyFlows: [{ from: 'a', to: 'b', value: 1e20 }] })?.field).toBe(
      'sankeyFlows',
    );
    expect(check({ sankeyNodes: [{ name: 'a', leftover: true }] })?.field).toBe('sankeyNodes');
    expect(check({ legendItems: [{ label: 'a', color: 1 }] })?.field).toBe('legendItems');
    expect(check({ stackColumns: 1 })?.field).toBe('stackColumns');
  });

  it("takes a product's own slice test", () => {
    const strict = chartRowChecks((v) => typeof v === 'object' && v !== null && 'value' in v);
    expect(shapeIssue({ shape: 'pie', pieSlices: [{ label: 'a' }] }, strict)?.field).toBe(
      'pieSlices',
    );
    expect(shapeIssue({ shape: 'pie', pieSlices: [{ label: 'a' }] }, chartRowChecks())).toBeNull();
  });

  it('builds the small checks a product lists itself', () => {
    const own = [flag('f'), finite('n'), dataArray('d'), oneOf('o', ['a', 'b'])];
    expect(shapeIssue({ shape: 'x', f: true, n: 1, d: [], o: 'b' }, own)).toBeNull();
    expect(shapeIssue({ shape: 'x', n: Infinity }, own)?.rule).toBe('a finite number');
    expect(shapeIssue({ shape: 'x', o: 'c' }, own)?.field).toBe('o');
    expect(isOptionalStrUpTo(undefined, 1)).toBe(true);
    expect(isOptionalStrUpTo('ab', 1)).toBe(false);
  });

  it('keeps the written-out refusal lists equal to their sources', () => {
    expect([...CHART_PALETTE_IDS_RULE]).toEqual(CHART_PALETTES.map((p) => p.id));
    expect([...CHIP_LOOKS_RULE]).toEqual([...CHIP_LOOKS]);
    expect([...ATTACH_POINTS_RULE]).toEqual([...ATTACH_POINTS]);
  });
});
