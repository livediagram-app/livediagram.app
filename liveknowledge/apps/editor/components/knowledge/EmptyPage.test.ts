import { describe, expect, it } from 'vitest';
import { isEmptyPage } from './EmptyPage';

const p = (style: string, text: string) => ({ type: 'paragraph', style, runs: [{ text }] });

describe('an empty page', () => {
  it('is one with nothing under its title', () => {
    expect(isEmptyPage(undefined)).toBe(true);
    expect(isEmptyPage({ a: { blocks: [p('title', 'Runbook')] } })).toBe(true);
    expect(isEmptyPage({ a: { blocks: [p('title', 'Runbook'), p('body', '  ')] } })).toBe(true);
  });

  it('is not one with words, or a block that is not a paragraph', () => {
    expect(isEmptyPage({ a: { blocks: [p('title', 'Runbook'), p('body', 'Step one')] } })).toBe(
      false,
    );
    expect(isEmptyPage({ a: { blocks: [p('title', 'Runbook'), { type: 'table' }] } })).toBe(false);
  });
});
