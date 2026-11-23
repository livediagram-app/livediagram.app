import { describe, expect, it } from 'vitest';
import { STICKY_PRESETS, type Element } from '@livediagram/document';
import {
  applyCodeBlockTheme,
  applyNoteFill,
  applyNotePreset,
  codeQuickStyle,
  noteQuickStyle,
} from './quick-style-kinds';

// docs/specs/008-canvas/quick-style-panel.md "Sticky notes and code blocks".
const note = (id: string, over: object = {}): Element => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...over,
});
const code = (id: string, over: object = {}): Element => ({
  id,
  type: 'shape',
  shape: 'code-block',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...over,
});
const box: Element = {
  id: 'b',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 9,
  height: 9,
};

describe('noteQuickStyle', () => {
  it('offers eight pad colours and marks the one every note wears', () => {
    const sky = STICKY_PRESETS.find((p) => p.name === 'Sky')!;
    const style = noteQuickStyle([note('a', { fillColor: sky.fill }), box])!;
    expect(style.ids).toEqual(['a']);
    expect(style.options).toHaveLength(8);
    expect(style.value).toBe(sky.id);
  });

  it('reads a note with no colour as the first sheet, and mixed or custom colours as none', () => {
    expect(noteQuickStyle([note('a')])!.value).toBe(STICKY_PRESETS[0]!.id);
    expect(noteQuickStyle([note('a'), note('b', { fillColor: '#123456' })])!.value).toBeNull();
  });

  it('passes over locked notes and other elements', () => {
    expect(noteQuickStyle([note('a', { locked: true }), box])).toBeUndefined();
  });
});

describe('codeQuickStyle', () => {
  it('marks the theme, the first one when unset', () => {
    expect(codeQuickStyle([code('c')])!.value).toBe('midnight');
    expect(codeQuickStyle([code('c', { codeTheme: 'paper' })])!.value).toBe('paper');
    expect(codeQuickStyle([code('c'), code('d', { codeTheme: 'paper' })])!.value).toBeNull();
    expect(codeQuickStyle([box])).toBeUndefined();
  });
});

describe('applying', () => {
  it('gives a note the pad colour’s paper and ink, and leaves other elements alone', () => {
    const rose = STICKY_PRESETS.find((p) => p.name === 'Rose')!;
    expect(applyNotePreset(note('a'), rose.id)).toMatchObject({
      fillColor: rose.fill,
      textColor: rose.text,
    });
    expect(applyNotePreset(box, rose.id)).toBe(box);
    expect(applyNotePreset(note('a'), 'no-such-preset')).toEqual(note('a'));
  });

  it('sets any paper colour on a note only', () => {
    expect(applyNoteFill(note('a'), '#123456')).toMatchObject({ fillColor: '#123456' });
    expect(applyNoteFill(box, '#123456')).toBe(box);
  });

  it('sets a code block’s theme only', () => {
    expect(applyCodeBlockTheme(code('c'), 'forest')).toMatchObject({ codeTheme: 'forest' });
    expect(applyCodeBlockTheme(box, 'forest')).toBe(box);
  });
});
