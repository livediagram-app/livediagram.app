import { describe, expect, it } from 'vitest';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, lockedFlow, run } from '../fixtures/run';

describe('unwrap', () => {
  it('removes the frame and leaves what it held where it was', () => {
    const outcome = run('unwrap f2');
    expect(lines(outcome)).toEqual(['- f2  frame "Payment" (unwrapped)']);
    expect(boxIn(applied(outcome).tab, 'n4')).toEqual(boxIn(checkoutFlow(), 'n4'));
  });

  it('takes arrows pinned to it along (EO36)', () => {
    expect(lines(run('connect f2 -> t1 id=link\nunwrap f2'))).toEqual([
      '- f2  frame "Payment" (unwrapped)',
    ]);
    expect(lines(run('connect n1 -> f2 id=link\nunwrap f2'))).toEqual([
      '- f2  frame "Payment" (unwrapped)',
    ]);
  });

  it('unwraps only a frame or lane, unlocked', () => {
    expect(refused(run('unwrap n3'))).toMatchObject({
      details: ['n3: n3 is not a frame or a lane'],
      hint: 'unwrap a frame or lane; rm removes anything else',
    });
    expect(refused(run('unwrap f2', lockedFlow('f2'))).code).toBe('element_locked');
    expect(refused(run('unwrap nowhere')).code).toBe('target_not_found');
  });
});
