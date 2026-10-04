import { describe, expect, it } from 'vitest';
import {
  LIVE_ELEMENT_FIELDS,
  getBuiltInTheme,
  quickSwatchColor,
  type Element,
} from '@livediagram/document';
import { aliasesOf, writeFieldsOnto, type FieldsWrite } from './fields';
import type { Fields } from './types';

const theme = getBuiltInTheme(undefined);
const square = {
  id: 'n3',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 140,
  height: 60,
  label: 'Login',
  note: 'Old',
} as Element;
const arrow = {
  id: 'a1',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 9, y: 9 },
} as Element;
const text = { id: 't1', type: 'text', x: 0, y: 0, width: 10, height: 10, label: 'Hi' } as Element;
const image = {
  id: 'i1',
  type: 'image',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  imageId: null,
} as unknown as Element;

const write = (el: Element, fields: Fields) => {
  const out = writeFieldsOnto(el, fields, theme, el.id, 1);
  if ('code' in out) throw new Error(out.details.join('\n'));
  return out;
};
const refusal = (el: Element, fields: Fields) => {
  const out = writeFieldsOnto(el, fields, theme, el.id, 1);
  if (!('code' in out)) throw new Error('expected a refusal');
  return out;
};
const nextOf = (out: FieldsWrite) => out.next as unknown as Record<string, unknown>;

describe('aliasesOf', () => {
  it('gives each element the aliases its type takes', () => {
    expect(aliasesOf(square)).toEqual(['label', 'note', 'shape', 'fill', 'text']);
    expect(aliasesOf(arrow)).toEqual(['label', 'text', 'line']);
    expect(aliasesOf(text)).toEqual(['label', 'note', 'text']);
    expect(aliasesOf(image)).toEqual(['label', 'note', 'text']);
  });
});

describe('writeFieldsOnto', () => {
  it('writes aliases, stored names, and unsets with null', () => {
    const out = write(square, {
      label: 'Sign in',
      text: 'lg',
      note: null,
      fill: 'blue',
      opacity: 0.5,
    });
    expect(nextOf(out)).toMatchObject({
      label: 'Sign in',
      textSize: 'lg',
      fillColor: quickSwatchColor(theme, 'fill', 5),
      fillSwatch: 5,
      opacity: 0.5,
    });
    expect(nextOf(out)).not.toHaveProperty('note');
    expect(out.written).toEqual(['label', 'text', 'note', 'fill', 'opacity']);
    expect(out.warnings).toEqual([]);
  });

  it('unsets the fill and its binding together', () => {
    const filled = write(square, { fill: 'red' }).next;
    expect(nextOf(write(filled, { fill: null }))).not.toHaveProperty('fillSwatch');
    expect(nextOf(write(filled, { fill: null, text: null, label: null }))).not.toHaveProperty(
      'fillColor',
    );
  });

  it('coerces an off-vocabulary shape with a warning', () => {
    const out = write(square, { shape: 'rectangle' });
    expect(nextOf(out).shape).toBe('square');
    expect(out.warnings).toEqual([
      { code: 'shape_coerced', ref: 'n3', message: 'n3 shape "rectangle" drawn as square' },
    ]);
  });

  it('warns when a hex overrides the theme, by alias or by stored name, but not on a sticky', () => {
    expect(write(square, { fill: '#ff0000' }).warnings[0]).toMatchObject({
      code: 'colour_overrides_theme',
    });
    expect(write(square, { strokeColor: '#000' }).warnings[0]!.message).toBe(
      'n3 strokeColor #000 overrides the theme; a theme colour follows a theme change',
    );
    const stickyEl = { id: 'k', type: 'sticky', x: 0, y: 0, width: 1, height: 1 } as Element;
    expect(write(stickyEl, { textColor: '#000' }).warnings).toEqual([]);
  });

  it('caps a long shape label into the note it ends with, and warns', () => {
    const out = write(square, {
      label: 'Orders service which creates and tracks every order',
      note: 'Given',
    });
    expect(nextOf(out)).toMatchObject({
      label: 'Orders service',
      note: 'Orders service which creates and tracks every order\n\nGiven',
    });
    expect(out.capped).toBe(true);
    expect(out.warnings[0]!.message).toBe(
      'n3 label kept as "Orders service"; the full text is in its note',
    );
    const onArrow = write(arrow, { label: 'Orders service which creates and tracks every order' });
    expect(onArrow.warnings[0]!.message).toBe(
      'a1 label kept as "Orders service"; the rest was cut',
    );
    expect(
      write(square, { label: 'Message queue for asynchronous events now' }).next,
    ).toMatchObject({
      note: 'Message queue for asynchronous events now\n\nOld',
    });
    const bare = { ...square, note: undefined } as Element;
    expect(
      write(bare, { label: 'Message queue for asynchronous events now', note: null }).next,
    ).toMatchObject({ note: 'Message queue for asynchronous events now' });
  });

  it('refuses identity, live and prototype fields, and keys the type lacks', () => {
    expect(refusal(square, { id: 'x' }).details[0]).toBe('id="x": cannot be changed');
    expect(refusal(square, { [LIVE_ELEMENT_FIELDS[0]!]: [] }).code).toBe('invalid_value');
    expect(refusal(square, JSON.parse('{"__proto__":1}')).code).toBe('unknown_field');
    const unknown = refusal(arrow, { fill: 'red' });
    expect(unknown.details).toEqual([
      'arrow has no field "fill"',
      expect.stringMatching(/^fields: label text line, then id type layerId /),
    ]);
  });

  it("checks each alias's value", () => {
    expect(
      [
        refusal(square, { label: 3 }),
        refusal(square, { shape: 3 }),
        refusal(square, { fill: 3 }),
        refusal(square, { fill: 'chartreuse' }),
        refusal(square, { text: 'huge' }),
        refusal(arrow, { line: 'wavy' }),
      ].map((r) => r.details),
    ).toEqual([
      ['label=3: text, in quotes when it has spaces'],
      ['shape=3: a shape kind'],
      ['fill=3: a theme colour or a hex'],
      [
        'fill=chartreuse: a theme colour or a hex',
        'allowed: theme red orange yellow green blue violet',
      ],
      ['text="huge": one of sm md lg scale'],
      ['line="wavy": one of straight angled curved'],
    ]);
    expect(nextOf(write(arrow, { line: 'angled' })).arrowStyle).toBe('angled');
    expect(nextOf(write(arrow, { line: null }))).not.toHaveProperty('arrowStyle');
  });

  it("writes a stroke's former point fields", () => {
    const stroke = {
      id: 'f',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      closed: false,
    } as unknown as Element;
    expect(nextOf(write(stroke, { points: [{ x: 0, y: 0 }] })).points).toEqual([{ x: 0, y: 0 }]);
  });
});
