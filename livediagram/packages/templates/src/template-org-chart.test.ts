import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { buildOrgChart } from './template-builders-trees';

type Boxed = Exclude<Element, { type: 'arrow' }>;
const boxed = (e: Element): e is Boxed => e.type !== 'arrow';

describe('the Org Chart template', () => {
  it('draws the key’s open-role sample see-through, so it stays muted on a dark canvas', () => {
    const elements = buildOrgChart(0, 0).filter(boxed);
    const label = elements.find((e) => e.label === 'Open role, hiring now')!;
    const sample = elements.find(
      (e) =>
        e.type === 'shape' &&
        e.strokeStyle === 'dashed' &&
        e.label === '' &&
        Math.abs(e.y + e.height / 2 - (label.y + label.height / 2)) < 2,
    );
    expect(sample?.type === 'shape' && sample.fillColor).toBe('transparent');
  });
});
