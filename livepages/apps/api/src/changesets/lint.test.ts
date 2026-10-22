import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livepages/document';
import { lintResult } from './lint';

const box = (id: string, x: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 0,
  width: 120,
  height: 60,
});
const where = { documentId: 'D', tabId: 't1' };

afterEach(() => vi.restoreAllMocks());

describe('lintResult', () => {
  it('lints the whole tab, logging with where it ran', () => {
    const infos: unknown[][] = [];
    vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => void infos.push(args));
    const joined = {
      id: 'x',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    } as Element;
    const report = lintResult({ elements: [box('a', 0), box('b', 60), joined] }, where);
    expect(report?.counts.error).toBe(1);
    expect(infos[0]).toEqual([
      '[lint] run',
      expect.objectContaining({ documentId: 'D', tabId: 't1', source: 'tab' }),
    ]);
  });

  it('judges colours on what the write set: none of a template replace, a change over the tab before', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const coloured = { ...box('a', 0), fillColor: '#123456' } as Element;
    const codes = (before: Parameters<typeof lintResult>[2]) =>
      lintResult({ elements: [coloured] }, where, before)!.findings.map((f) => f.code);
    expect(codes(null)).toEqual(['colour-on-themed']);
    expect(codes('template')).toEqual([]);
    expect(codes({ elements: [coloured] })).toEqual([]);
    expect(codes({ elements: [box('a', 0)] })).toEqual(['colour-on-themed']);
  });

  it('logs the lint\x27s warnings and debug lines at their levels', () => {
    const warns: unknown[][] = [];
    const debugs: unknown[][] = [];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => void warns.push(args));
    vi.spyOn(console, 'debug').mockImplementation((...args: unknown[]) => void debugs.push(args));
    const arrows: Element[] = Array.from({ length: 301 }, (_, i) => ({
      id: `x${i}`,
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    })) as Element[];
    lintResult(
      {
        elements: [box('a', 0), { ...box('b', 300), fillColor: '#123456' } as Element, ...arrows],
        theme: 'custom-1',
      },
      where,
    );
    expect(warns[0]?.[0]).toBe('[lint] crossings skipped');
    expect(debugs[0]?.[0]).toBe('[lint] theme unresolved');
  });
});
