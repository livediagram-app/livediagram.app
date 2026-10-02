import { describe, expect, it } from 'vitest';
import type { Element } from './index';
import { migrateLegacyTextSizing } from './legacy-text-sizing';

const text = (over: Record<string, unknown> = {}) =>
  ({ id: 't', type: 'text', x: 0, y: 0, width: 40, height: 22, label: 'Hi', ...over }) as Element;

// docs/specs/007-editor/editor-modes.md "A text box's sizing": `sizing` replaces `autoWidth`.
describe('migrateLegacyTextSizing', () => {
  it('reads a stored auto width as a text box that fits its words', () => {
    const [out] = migrateLegacyTextSizing([text({ autoWidth: true })]);
    expect(out).toEqual(text({ sizing: 'fit' }));
  });

  it('drops a stored auto width of false, leaving a fixed box', () => {
    const [out] = migrateLegacyTextSizing([text({ autoWidth: false })]);
    expect(out).toEqual(text());
  });

  it('keeps a sizing already stored over a stale auto width', () => {
    const [out] = migrateLegacyTextSizing([text({ sizing: 'wrap', autoWidth: true })]);
    expect(out).toEqual(text({ sizing: 'wrap' }));
  });

  it('returns the same array when nothing carries an auto width', () => {
    const els = [text(), text({ id: 'u', sizing: 'fit' })];
    expect(migrateLegacyTextSizing(els)).toBe(els);
  });
});
