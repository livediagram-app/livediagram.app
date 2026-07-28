import { describe, expect, it } from 'vitest';
import { runsPlainText, type TextRun } from '@livediagram/diagram';
import { canonicalNote, noteFieldsEqual } from './note-value';

describe('canonicalNote', () => {
  it('stores a plain note as text only, with no runs', () => {
    expect(canonicalNote('just a note')).toEqual({ note: 'just a note' });
    expect(canonicalNote('', [{ text: 'just a note' }])).toEqual({ note: 'just a note' });
  });

  it('keeps runs when they carry formatting, and mirrors them exactly', () => {
    const runs: TextRun[] = [{ text: 'Ship ' }, { text: 'today', bold: true }];
    const out = canonicalNote('Ship today', runs);
    expect(out.note).toBe('Ship today');
    expect(out.noteRich).toEqual(runs);
    expect(runsPlainText(out.noteRich!)).toBe(out.note);
  });

  it('trims on the runs so the mirror never drifts from them', () => {
    const runs: TextRun[] = [{ text: '  ' }, { text: 'Title', heading: 1 }, { text: ' \n ' }];
    const out = canonicalNote('  Title \n ', runs);
    expect(out.note).toBe('Title');
    expect(out.noteRich).toEqual([{ text: 'Title', heading: 1 }]);
    expect(runsPlainText(out.noteRich!)).toBe(out.note);
  });

  it('reads as empty for whitespace-only input, so the caller strips both fields', () => {
    expect(canonicalNote('   \n  ')).toEqual({ note: '' });
    expect(canonicalNote('', [{ text: '  ', bold: true }])).toEqual({ note: '' });
    expect(canonicalNote('', [])).toEqual({ note: '' });
  });

  it('falls back to the plain string when there are no runs', () => {
    expect(canonicalNote('from a legacy caller', [])).toEqual({ note: 'from a legacy caller' });
  });
});

describe('noteFieldsEqual', () => {
  it('is true for an unchanged plain note', () => {
    expect(noteFieldsEqual(canonicalNote('same'), canonicalNote('same'))).toBe(true);
  });

  it('spots a formatting-only change the plain mirror hides', () => {
    const plain = canonicalNote('Ship today', [{ text: 'Ship today' }]);
    const bold = canonicalNote('Ship today', [{ text: 'Ship today', bold: true }]);
    expect(plain.note).toBe(bold.note);
    expect(noteFieldsEqual(plain, bold)).toBe(false);
  });

  it('spots a text change', () => {
    expect(noteFieldsEqual(canonicalNote('a'), canonicalNote('b'))).toBe(false);
  });
});
