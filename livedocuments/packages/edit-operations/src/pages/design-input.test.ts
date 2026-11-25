import { describe, expect, it } from 'vitest';
import { PAGE_DESIGNS, type Element, type Tab } from '@livedocuments/document';
import { designNamed, readPageDesign, readTabDesign, tabDesignFor } from './design-input';

// docs/specs/024-agents/pages-for-agents.md "Page designs": every way a design read from an agent is kept or refused.
const still = PAGE_DESIGNS.find((d) => !d.animates)!;
const moving = PAGE_DESIGNS.find((d) => d.animates)!;
const flowing = PAGE_DESIGNS.find((d) => d.flows)!;
const fixed = PAGE_DESIGNS.find((d) => !d.flows)!;
const styled = PAGE_DESIGNS.find((d) => d.variants?.length)!;
const plain = PAGE_DESIGNS.find((d) => !d.variants?.length)!;

const refused = (out: unknown) => (out as { refused: { code: string; message: string } }).refused;

describe('a design read from an agent', () => {
  it('names an unknown design with or without close ids, and the families', () => {
    const near = designNamed('auror');
    expect(typeof near === 'object' && near.message).toContain('Closest:');
    const far = designNamed('qqqqqqqqqqqq');
    expect(typeof far === 'object' && far.code).toBe('design_unknown');
    expect(typeof far === 'object' && far.message).not.toContain('Closest:');
  });

  it('keeps every tuning in range, rounding angle and seed', () => {
    expect(
      readTabDesign({
        id: moving.id,
        colors: ['#AABBCC', '#112233', '#445566'],
        angle: 44.6,
        seed: 7.4,
        focus: [0.2, 0.8],
        animate: true,
        guard: 'warn',
        rhythm: true,
      }),
    ).toMatchObject({
      id: moving.id,
      colors: ['#aabbcc', '#112233', '#445566'],
      angle: 45,
      seed: 7,
      focus: [0.2, 0.8],
      animate: true,
      guard: 'warn',
      rhythm: true,
    });
    expect(readPageDesign({ id: still.id, animate: false, guard: 'scrim' })).toEqual({
      id: still.id,
    });
    expect(readTabDesign({ id: flowing.id, flow: true, rhythm: false })).toMatchObject({
      flow: true,
    });
    const variant = styled.variants![0]!.id;
    expect(readPageDesign({ id: styled.id, variant })).toMatchObject({ id: styled.id });
  });

  it.each([
    [{ id: still.id, sparkle: 1 }, 'takes no "sparkle"'],
    [{ id: still.id, rhythm: true }, 'set by tab_design'],
    [{ id: 3 }, '"design.id" names a design'],
    [{ id: 'qqqqqqqqqqqq' }, 'No page design'],
    [{ id: still.id, colors: ['#fff'] }, 'three hex colours'],
    [{ id: still.id, colors: 'red' }, 'three hex colours'],
    [{ id: still.id, angle: 400 }, '"design.angle"'],
    [{ id: still.id, seed: 0 }, '"design.seed"'],
    [{ id: still.id, focus: 0.5 }, '"design.focus" is [x, y]'],
    [{ id: still.id, focus: [0.5, 2] }, '"design.focus" is a number'],
    [{ id: styled.id, variant: 'nope' }, 'is one of'],
    [{ id: styled.id, variant: 4 }, 'is one of'],
    [{ id: plain.id, variant: 'any' }, 'has no styles'],
    [{ id: still.id, animate: 'yes' }, '"design.animate" is true or false'],
    [{ id: still.id, animate: true }, 'does not move'],
    [{ id: still.id, guard: 'loud' }, '"design.guard"'],
  ])('refuses a page design %j', (v, words) => {
    expect(refused(readPageDesign(v)).message).toContain(words);
  });

  it('refuses a tab design’s bad switches and a value of the wrong kind', () => {
    expect(refused(readTabDesign({ id: fixed.id, flow: true })).message).toContain(
      'cannot flow across pages',
    );
    expect(refused(readTabDesign({ id: still.id, rhythm: 'on' })).message).toContain(
      '"design.rhythm" is true or false',
    );
    expect(refused(readTabDesign(4)).message).toContain('null to clear it, or "auto"');
    expect(refused(readPageDesign(4)).message).toContain('"none" or "tab"');
    expect(refused(readTabDesign('qqqqqqqqqqqq')).code).toBe('design_unknown');
    expect(readTabDesign(null)).toBeNull();
    expect(readTabDesign('auto')).toBe('auto');
    expect(readPageDesign('tab')).toBe('tab');
  });

  it('lets an error that is not a refusal through', () => {
    const v = {
      id: still.id,
      get scale(): number {
        throw new Error('broken getter');
      },
    };
    expect(() => readPageDesign(v)).toThrow('broken getter');
  });

  it('picks "auto" from the tab’s name, its pages’ names and its texts', () => {
    const tab: Tab = {
      id: 't',
      elements: [
        { id: 'a', type: 'text', label: 'Galaxy launch' } as unknown as Element,
        { id: 'b', type: 'line' } as unknown as Element,
      ],
      pages: [
        { id: 'p', orientation: 'landscape', size: 'slide', kind: 'slide', name: 'Night sky' },
      ],
    } as Tab;
    const picked = tabDesignFor(tab, 'auto');
    expect(PAGE_DESIGNS.some((d) => d.id === picked?.id)).toBe(true);
    expect(tabDesignFor(tab, null)).toBeNull();
  });
});
