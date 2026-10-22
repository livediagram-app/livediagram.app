import { describe, expect, it } from 'vitest';
import { resolveArrowEnds } from './arrow-ends';

const arrow = (from: string, to: string) => ({
  id: 'a1',
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
});

describe('resolveArrowEnds', () => {
  const ids = ['4aeb12f0-0000', '9c11aa00-0000', 'web'];

  it('rewrites a printed ref on either end to the element id', () => {
    const out = resolveArrowEnds([arrow('4aeb', '9c11')], ids);
    expect(out).toEqual({ elements: [arrow('4aeb12f0-0000', '9c11aa00-0000')] });
  });

  it('keeps ends that already name an id, and non-arrows, untouched', () => {
    const box = { id: 'web', type: 'shape' };
    const out = resolveArrowEnds([box, arrow('web', '4aeb12f0-0000')], ids);
    expect(out).toEqual({ elements: [box, arrow('web', '4aeb12f0-0000')] });
  });

  it('refuses an end that names nothing, naming the arrow and the side', () => {
    const out = resolveArrowEnds([arrow('web', 'ghost')], ids);
    expect('error' in out && out.error).toMatch(/arrow "a1": "to" is pinned to "ghost"/);
  });

  it('refuses an ambiguous ref with its candidates', () => {
    const out = resolveArrowEnds([arrow('web', 'x')], ['xa', 'xb', 'web']);
    expect('error' in out && out.error).toMatch(/more than one element \(xa, xb\)/);
  });

  it('leaves free ends alone', () => {
    const free = { ...arrow('web', 'web'), to: { kind: 'free', x: 1, y: 2 } };
    expect(resolveArrowEnds([free], ids)).toEqual({ elements: [free] });
  });
});
