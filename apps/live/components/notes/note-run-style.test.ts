import { describe, expect, it } from 'vitest';
import type { TextRun } from '@livediagram/diagram';
import { noteRunHref, noteRunStyle, NOTE_BASE_PX } from './note-run-style';
import { noteRuns, runsToLines } from './NoteRichText';

describe('noteRunHref', () => {
  it('passes http / https / mailto through', () => {
    expect(noteRunHref({ text: 'x', link: 'https://example.com' })).toBe('https://example.com');
    expect(noteRunHref({ text: 'x', link: 'http://example.com' })).toBe('http://example.com');
    expect(noteRunHref({ text: 'x', link: 'mailto:a@example.com' })).toBe('mailto:a@example.com');
  });

  it('refuses a scheme that would execute, however it got stored', () => {
    expect(noteRunHref({ text: 'x', link: 'javascript:alert(1)' })).toBeNull();
    expect(noteRunHref({ text: 'x', link: 'data:text/html,<script>' })).toBeNull();
    expect(noteRunHref({ text: 'x', link: 'not a url' })).toBeNull();
  });

  it('is null for an unlinked run', () => {
    expect(noteRunHref({ text: 'x' })).toBeNull();
  });
});

describe('noteRunStyle', () => {
  it('falls back to the body size for a run with no overrides', () => {
    expect(noteRunStyle({ text: 'x' }).fontSize).toBe(`${NOTE_BASE_PX}px`);
  });

  it('renders a heading larger and heavier than the body', () => {
    const h1 = noteRunStyle({ text: 'x', heading: 1 });
    const h2 = noteRunStyle({ text: 'x', heading: 2 });
    expect(parseFloat(String(h1.fontSize))).toBeGreaterThan(parseFloat(String(h2.fontSize)));
    expect(parseFloat(String(h2.fontSize))).toBeGreaterThan(NOTE_BASE_PX);
    expect(h1.fontWeight).toBe(700);
    expect(h2.fontWeight).toBe(600);
  });

  it('underlines a safe link but not an unsafe one', () => {
    expect(noteRunStyle({ text: 'x', link: 'https://example.com' }).textDecoration).toBe(
      'underline',
    );
    expect(noteRunStyle({ text: 'x', link: 'javascript:alert(1)' }).textDecoration).toBeUndefined();
  });

  it('combines underline + strikethrough, and lets an explicit colour win', () => {
    const style = noteRunStyle({
      text: 'x',
      underline: true,
      strikethrough: true,
      color: '#ff0000',
      link: 'https://example.com',
    });
    expect(style.textDecoration).toBe('underline line-through');
    expect(style.color).toBe('#ff0000');
  });
});

describe('runsToLines', () => {
  it('splits runs at newlines, keeping each fragment formatted', () => {
    const runs: TextRun[] = [{ text: 'one\ntw', bold: true }, { text: 'o' }];
    expect(runsToLines(runs)).toEqual([
      [{ text: 'one', bold: true }],
      [{ text: 'tw', bold: true }, { text: 'o' }],
    ]);
  });

  it('keeps an empty row for a blank line', () => {
    expect(runsToLines([{ text: 'a\n\nb' }])).toEqual([[{ text: 'a' }], [], [{ text: 'b' }]]);
  });

  it('always yields at least one line', () => {
    expect(runsToLines([])).toEqual([[]]);
  });
});

describe('noteRuns', () => {
  it('prefers stored runs', () => {
    const runs: TextRun[] = [{ text: 'rich', bold: true }];
    expect(noteRuns('rich', runs)).toBe(runs);
  });

  it('falls back to the plain mirror for a pre-spec/92 note', () => {
    expect(noteRuns('plain', undefined)).toEqual([{ text: 'plain' }]);
    expect(noteRuns('plain', [])).toEqual([{ text: 'plain' }]);
    expect(noteRuns(undefined, undefined)).toEqual([]);
  });
});
