import { describe, expect, it } from 'vitest';
import type { PageColourFill } from './index';
import { everyPageMessage, newPageBackgroundLabel } from './new-page-background-label';

const mint = { kind: 'solid' as const, color: '#ccfbf1' };
const ramp: PageColourFill = { kind: 'gradient', from: '#fff', to: '#000', angle: 160 };
const none = () => undefined;

describe('newPageBackgroundLabel', () => {
  it('names none, the paper, a named fill, each kind of fill and a pattern', () => {
    expect(newPageBackgroundLabel(undefined, none)).toBe('Like the page before');
    expect(newPageBackgroundLabel({}, none)).toBe('Paper');
    expect(newPageBackgroundLabel({ fill: mint }, () => 'Mint')).toBe('Mint');
    expect(newPageBackgroundLabel({ fill: mint, pattern: 'dots' }, none)).toBe(
      'Solid colour, dots',
    );
    expect(newPageBackgroundLabel({ fill: ramp }, none)).toBe('Custom gradient');
    expect(
      newPageBackgroundLabel({ fill: { ...ramp, motion: 'flow' } as PageColourFill }, none),
    ).toBe('Animated');
    expect(newPageBackgroundLabel({ fill: { kind: 'image' } }, none)).toBe('Picture');
  });
});

describe('everyPageMessage', () => {
  it('counts the pages reached and the locked ones kept', () => {
    expect(everyPageMessage(1, 0)).toBe('Background applied to 1 page.');
    expect(everyPageMessage(3, 0)).toBe('Background applied to 3 pages.');
    expect(everyPageMessage(2, 1)).toBe(
      'Background applied to 2 pages. 1 page locked kept its own.',
    );
    expect(everyPageMessage(0, 2)).toBe('Every page is locked: 2 pages locked kept their own.');
  });
});
