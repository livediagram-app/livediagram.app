import { describe, expect, it } from 'vitest';
import {
  applyBpmnVariant,
  BPMN_DATA_OBJECT_GEOMETRY,
  BPMN_FAMILY_SYMBOLS,
  BPMN_FLOW_LOOKS,
  BPMN_FLOWS,
  BPMN_POOL_FIELDS,
  BPMN_SYMBOL_LABELS,
  BPMN_SYMBOLS,
  bpmnBodyGeometry,
  bpmnFamilyOf,
  bpmnFields,
  bpmnKindOf,
  bpmnMarkParts,
  bpmnNameSitsUnder,
  bpmnSize,
  bpmnSymbolOf,
  isBpmnFlow,
  isBpmnSymbol,
  withBpmnSymbol,
} from './bpmn';
import { bpmnMarkFace, svgBpmnMarks } from './svg-render-bpmn';
import { applyShapeVariant } from './shape-variants';
import { elementValidationIssue, isValidElement } from './validate';

// docs/specs/009-elements/bpmn.md

describe('the BPMN vocabulary', () => {
  it('splits every symbol into exactly one family, on its own kind', () => {
    const fromFamilies = Object.values(BPMN_FAMILY_SYMBOLS).flat();
    expect([...fromFamilies].sort()).toEqual([...BPMN_SYMBOLS].sort());
    for (const s of BPMN_SYMBOLS) {
      expect(BPMN_FAMILY_SYMBOLS[bpmnFamilyOf(s)]).toContain(s);
      expect(BPMN_SYMBOL_LABELS[s].length).toBeGreaterThan(0);
    }
    expect(bpmnKindOf('start')).toBe('circle');
    expect(bpmnKindOf('task-user')).toBe('square');
    expect(bpmnKindOf('gateway-parallel')).toBe('diamond');
    expect(bpmnKindOf('data-object')).toBe('document');
    expect(bpmnKindOf('data-store')).toBe('cylinder');
  });

  it('accepts only its own symbols', () => {
    expect(isBpmnSymbol('end-terminate')).toBe(true);
    expect(isBpmnSymbol('start-signal')).toBe(false);
    expect(isBpmnSymbol(3)).toBe(false);
  });

  it('reads a symbol only on its own kind', () => {
    expect(bpmnSymbolOf({ shape: 'circle', bpmn: 'start' })).toBe('start');
    expect(bpmnSymbolOf({ shape: 'square', bpmn: 'start' })).toBeUndefined();
    expect(bpmnSymbolOf({ shape: 'circle', bpmn: 'nope' })).toBeUndefined();
    expect(bpmnSymbolOf({ shape: 'circle' })).toBeUndefined();
  });

  it('puts a name under every symbol but a task', () => {
    expect(bpmnNameSitsUnder('start')).toBe(true);
    expect(bpmnNameSitsUnder('gateway')).toBe(true);
    expect(bpmnNameSitsUnder('data-store')).toBe(true);
    expect(bpmnNameSitsUnder('task-user')).toBe(false);
  });

  it('sizes each family as the spec says', () => {
    expect(bpmnSize('end')).toEqual({ width: 48, height: 48 });
    expect(bpmnSize('gateway')).toEqual({ width: 56, height: 56 });
    expect(bpmnSize('subprocess')).toEqual({ width: 128, height: 80 });
    expect(bpmnSize('data-object')).toEqual({ width: 44, height: 56 });
    expect(bpmnSize('data-store')).toEqual({ width: 60, height: 56 });
    expect(bpmnFields('task')).toMatchObject({ bpmn: 'task', borderRadius: 'md', label: '' });
    expect(bpmnFields('start')).not.toHaveProperty('borderRadius');
  });
});

describe('changing the symbol', () => {
  const event = { type: 'shape', shape: 'circle', bpmn: 'start' as const, fillColor: '#fff' };

  it('changes within the family and keeps the rest', () => {
    expect(withBpmnSymbol(event, 'end-error')).toEqual({ ...event, bpmn: 'end-error' });
  });

  it('switches a data object to a data store with its kind', () => {
    const page = { type: 'shape', shape: 'document', bpmn: 'data-object' as const };
    expect(withBpmnSymbol(page, 'data-store')).toEqual({
      ...page,
      shape: 'cylinder',
      bpmn: 'data-store',
    });
  });

  it('leaves another family, a plain shape, a non-shape and the same symbol alone', () => {
    expect(withBpmnSymbol(event, 'task')).toBe(event);
    const plain = { type: 'shape', shape: 'circle' };
    expect(withBpmnSymbol(plain, 'end')).toBe(plain);
    const text = { type: 'text' };
    expect(withBpmnSymbol(text, 'end')).toBe(text);
    expect(withBpmnSymbol(event, 'start')).toBe(event);
  });
});

describe('the palette variants', () => {
  it('places each tile on its own kind', () => {
    expect(applyBpmnVariant({ shape: 'circle' }, 'bpmn-start')).toMatchObject({
      bpmn: 'start',
      width: 48,
    });
    expect(applyBpmnVariant({ shape: 'square' }, 'bpmn-user-task')).toMatchObject({
      bpmn: 'task-user',
    });
    expect(applyBpmnVariant({ shape: 'lane' }, 'bpmn-pool')).toMatchObject(BPMN_POOL_FIELDS);
  });

  it('refuses another kind, an unknown or a missing variant', () => {
    expect(applyBpmnVariant({ shape: 'square' }, 'bpmn-start')).toBeNull();
    expect(applyBpmnVariant({ shape: 'square' }, 'bpmn-pool')).toBeNull();
    expect(applyBpmnVariant({ shape: 'circle' }, 'toString')).toBeNull();
    expect(applyBpmnVariant({ shape: 'circle' }, undefined)).toBeNull();
  });

  it('runs through the one variant path every placement takes', () => {
    expect(applyShapeVariant({ shape: 'diamond' } as never, 'bpmn-parallel')).toMatchObject({
      bpmn: 'gateway-parallel',
    });
  });
});

describe('the flows', () => {
  it('has a look per flow', () => {
    expect(BPMN_FLOWS.every(isBpmnFlow)).toBe(true);
    expect(isBpmnFlow('sequence')).toBe(false);
    expect(BPMN_FLOW_LOOKS.message).toMatchObject({ strokeStyle: 'dashed', arrowEnds: 'both' });
    expect(BPMN_FLOW_LOOKS.association).toMatchObject({ strokeStyle: 'dotted', arrowEnds: 'none' });
  });
});

describe('the mark', () => {
  it('draws the data object as a folded page and nothing else differently', () => {
    expect(bpmnBodyGeometry({ shape: 'document', bpmn: 'data-object' })).toBe(
      BPMN_DATA_OBJECT_GEOMETRY,
    );
    expect(bpmnBodyGeometry({ shape: 'document' })).toBeNull();
  });

  it('draws finite parts for every symbol, and none for the plain start, task, gateway and data', () => {
    for (const s of BPMN_SYMBOLS) {
      const parts = bpmnMarkParts(s, 120, 80);
      for (const p of parts) {
        expect(p.d).not.toMatch(/NaN|Infinity|undefined/);
        expect(p.width).toBeGreaterThanOrEqual(0);
      }
      const bare = ['start', 'task', 'gateway', 'data-object', 'data-store'].includes(s);
      expect(parts.length === 0).toBe(bare);
    }
  });

  it('exports the same parts at the element, in its colours', () => {
    const el = { shape: 'circle', bpmn: 'end-message', x: 10, y: 20, width: 48, height: 48 };
    const svg = svgBpmnMarks(el, '#ffeeaa', '#112233');
    expect(svg).toContain('data-bpmn="end-message"');
    expect(svg).toContain('translate(10 20)');
    expect(svg).toContain('#112233');
    expect(svgBpmnMarks({ ...el, shape: 'square' }, '#fff', '#000')).toBe('');
    expect(svgBpmnMarks({ ...el, bpmn: 'start' }, '#fff', '#000')).toBe('');
  });

  it('paints every part kind', () => {
    const paints = new Set(
      BPMN_SYMBOLS.flatMap((s) => bpmnMarkParts(s, 120, 80).map((p) => p.paint)),
    );
    for (const s of BPMN_SYMBOLS) {
      if (bpmnMarkParts(s, 120, 80).length === 0) continue;
      const el = { shape: bpmnKindOf(s), bpmn: s, x: 0, y: 0, width: 120, height: 80 };
      expect(svgBpmnMarks(el, 'transparent', '#000')).toContain('<path');
    }
    expect(paints.size).toBeGreaterThanOrEqual(3);
  });

  it('gives a transparent shape a white face', () => {
    expect(bpmnMarkFace('transparent')).toBe('#ffffff');
    expect(bpmnMarkFace('none')).toBe('#ffffff');
    expect(bpmnMarkFace('')).toBe('#ffffff');
    expect(bpmnMarkFace('#abc')).toBe('#abc');
  });
});

describe('validation', () => {
  const shape = {
    id: 'a',
    type: 'shape',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 48,
    height: 48,
    label: '',
  };

  it('keeps a known symbol and refuses an unknown one by name', () => {
    expect(isValidElement({ ...shape, bpmn: 'start' })).toBe(true);
    expect(isValidElement({ ...shape, bpmn: 'start-signal' })).toBe(false);
    expect(JSON.stringify(elementValidationIssue({ ...shape, bpmn: 'start-signal' }))).toContain(
      'bpmn',
    );
  });
});
