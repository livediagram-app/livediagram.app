import { describe, expect, it } from 'vitest';
import { applied, lines, refused } from '../fixtures/outcomes';
import { lockedFlow, run } from '../fixtures/run';

const ids = (text: string) =>
  applied(run(text))
    .tab.elements.map((el) => el.id)
    .join(' ');

describe('order', () => {
  it('sends to the front and the back', () => {
    expect(ids('order t1 front')).toBe('f2 n1 n2 n3 n4 n5 n6 n7 n8 a1 a2 a3 a4 a5 a6 a7 t1');
    expect(ids('order t1 back')).toBe('t1 f2 n1 n2 n3 n4 n5 n6 n7 n8 a1 a2 a3 a4 a5 a6 a7');
    expect(lines(run('order t1 back'))).toEqual(['~ t1  order back']);
  });

  it('places directly above or below another', () => {
    expect(ids('order n3 below=n1')).toBe('f2 n3 n1 n2 n4 n5 n6 n7 n8 t1 a1 a2 a3 a4 a5 a6 a7');
    expect(ids('order n1 above=n3')).toBe('f2 n2 n3 n1 n4 n5 n6 n7 n8 t1 a1 a2 a3 a4 a5 a6 a7');
    expect(lines(run('order n1 above=n3'))).toEqual(['~ n1  order above n3']);
  });

  it('keeps a container behind its members, whatever it was told (EO37)', () => {
    expect(ids('order f2 front')).toBe('n1 n2 n3 f2 n4 n5 n6 n7 n8 t1 a1 a2 a3 a4 a5 a6 a7');
  });

  it('refuses ordering against itself, a missing other, and a locked target', () => {
    expect(refused(run('order n3 above=n3')).details).toEqual([
      'above=n3: an element is not ordered against itself',
    ]);
    expect(refused(run('order n3 below=nowhere')).code).toBe('target_not_found');
    expect(refused(run('order n3 front', lockedFlow('n3'))).code).toBe('element_locked');
    expect(refused(run('order nowhere front')).code).toBe('target_not_found');
  });
});
