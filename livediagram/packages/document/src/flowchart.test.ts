import { describe, expect, it } from 'vitest';
import { createFlowchartStart, createFlowchartStep } from './flowchart';
import { addFlowchartLane, applyFlowchartStep, planFlowchartStep } from './flowchart-grow';
import { duplicateElements } from './duplicate';
import { elementKindLabel } from './element-kind-label';
import type { ShapeElement } from './index';

// docs/specs/009-elements/flowchart.md. The flowchart itself is tested where it lives,
// @liveworkspace/element-model; these are the parts this model adds: its step factories, its kind
// labels and its copies.

describe('flowchart, as this model binds it', () => {
  it('a step is born from the shape factory here, sized for its type', () => {
    const d = createFlowchartStep('decision', 10, 20);
    expect(d).toMatchObject({
      type: 'shape',
      shape: 'diamond',
      x: 10,
      y: 20,
      width: 200,
      height: 120,
    });
    expect(d.textSize).toBe('md');
  });

  it('a step is named by its step type, a plain shape by its kind', () => {
    const d: ShapeElement = { ...createFlowchartStep('decision', 0, 0), flowchartId: 'c' };
    expect(elementKindLabel(d)).toBe('Decision');
    expect(elementKindLabel({ ...d, flowchartId: undefined })).toBe('Diamond');
  });

  it('a copied chart is a new chart, its lanes followed and missing lanes dropped', () => {
    const start = createFlowchartStart(0, 0);
    const plan = planFlowchartStep([start], start.id, 'next', { step: 's1', connector: 'c1' })!;
    const grown = applyFlowchartStep([start], plan);
    const laned = addFlowchartLane(grown, start.id, ['l1', 'l2']);
    expect(laned.find((e) => e.id === 'l1')).toMatchObject({ shape: 'lane', label: 'Lane 1' });
    const { newElements, idMap } = duplicateElements(
      laned,
      new Set([start.id, plan.step.id, 'l1']),
      40,
      40,
    );
    const copyStart = newElements.find((e) => e.id === idMap.get(start.id)) as ShapeElement;
    expect(copyStart.flowchartId).toBe(copyStart.id);
    for (const el of newElements)
      if (el.type === 'shape') expect(el.flowchartId).toBe(copyStart.id);
    expect(copyStart.flowLaneId).toBe(idMap.get('l1'));

    const lone = duplicateElements(laned, new Set([plan.step.id]), 40, 40)
      .newElements[0] as ShapeElement;
    expect(lone.flowchartId).toBe(lone.id);
    expect(lone.flowLaneId).toBeUndefined();
  });
});
