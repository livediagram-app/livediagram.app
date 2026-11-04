import { describe, expect, it } from 'vitest';
import {
  LIVE_ELEMENT_FIELDS,
  getBuiltInTheme,
  shapeColorPresets,
  quickSwatchColor,
  type Element,
} from '@livedocuments/document';
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
  it('gives each element the aliases its type takes, style keys included', () => {
    const style = ['stroke', 'text-color', 'border'];
    expect(aliasesOf(square)).toEqual(['label', 'shape', 'fill', ...style, 'text']);
    expect(aliasesOf(arrow)).toEqual(['label', ...style, 'text', 'line']);
    expect(aliasesOf(text)[0]).toBe('label');
    expect(aliasesOf(text)).not.toContain('note');
    expect(aliasesOf(image)).toContain('label');
  });

  it('writes back every style key the views print', () => {
    const out = writeFieldsOnto(
      square,
      { stroke: '#aa0000', 'text-color': '#00aa00', border: 'dashed' },
      theme,
      'n1',
      1,
    );
    if ('code' in out) throw new Error('refused');
    expect(nextOf(out)).toMatchObject({
      strokeColor: '#aa0000',
      textColor: '#00aa00',
      strokeStyle: 'dashed',
    });
    expect(out.warnings.map((w) => w.code)).toEqual([
      'colour_overrides_theme',
      'colour_overrides_theme',
    ]);
    const unset = writeFieldsOnto(
      { ...square, strokeColor: '#aa0000', strokeSwatch: 2 } as Element,
      { stroke: null, border: null },
      theme,
      'n1',
      1,
    );
    if ('code' in unset) throw new Error('refused');
    expect(nextOf(unset)).not.toHaveProperty('strokeColor');
    expect(nextOf(unset)).not.toHaveProperty('strokeSwatch');
    const named = writeFieldsOnto(square, { stroke: 'pen-red' }, theme, 'n1', 1);
    expect('code' in named ? null : named.warnings).toEqual([]);
    expect(refusal(square, { border: 'wavy' }).details[0]).toMatch(
      /^border="wavy": one of solid dashed dotted/,
    );
    expect(refusal(square, { stroke: 3 }).code).toBe('invalid_value');
  });
});

describe('writeFieldsOnto', () => {
  it('writes aliases, stored names, and unsets with null', () => {
    const out = write(square, {
      label: 'Sign in',
      text: 'lg',
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
    expect(out.written).toEqual(['label', 'text', 'fill', 'opacity']);
    expect(out.warnings).toEqual([]);
  });

  it('unsets the fill and its binding together', () => {
    const filled = write(square, { fill: 'red' }).next;
    expect(nextOf(write(filled, { fill: null }))).not.toHaveProperty('fillSwatch');
    expect(nextOf(write(filled, { fill: null, text: null, label: null }))).not.toHaveProperty(
      'fillColor',
    );
  });

  it('dresses a shape in its preset’s colours for the theme, a colour named with it winning', () => {
    const preset = shapeColorPresets(theme).find((p) => p.id === 'tinted')!;
    expect(nextOf(write(square, { colorPreset: 'tinted' }))).toMatchObject({
      colorPreset: 'tinted',
      fillColor: preset.fill,
      strokeColor: preset.stroke,
    });
    expect(nextOf(write(square, { colorPreset: 'tinted', fillColor: '#ff0000' })).fillColor).toBe(
      '#ff0000',
    );
    expect(refusal(square, { colorPreset: 'sparkly' }).hint).toMatch(/^colorPreset takes .*tinted/);
  });

  it('keeps a border width and style named with a preset, over the preset’s own', () => {
    // Outline brings a medium dashed border; the write asks for thick and solid.
    expect(
      nextOf(write(square, { colorPreset: 'outline', strokeWidth: 'thick', strokeStyle: 'solid' })),
    ).toMatchObject({ colorPreset: 'outline', strokeWidth: 'thick', strokeStyle: 'solid' });
  });

  it('takes a known icon id and refuses one that draws a question mark, naming icons like it', () => {
    const icon = { ...square, id: 'ic', iconId: 'clock' } as Element;
    expect(nextOf(write(icon, { iconId: 'moon' })).iconId).toBe('moon');
    const out = refusal(icon, { iconId: 'fire' });
    expect(out.details).toEqual(['iconId="fire": is not an icon']);
    expect(out.hint).toContain('flame');
    expect(refusal(icon, { iconId: 'qqqqzz' }).hint).toContain('plain words');
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

  // Element notes are retired (docs/specs/009-elements/links-and-notes-retired.md): the rest is cut, the stored note
  // left as it was.
  it('caps a long label, cutting the rest, and warns', () => {
    const out = write(square, { label: 'Orders service which creates and tracks every order' });
    expect(nextOf(out)).toMatchObject({ label: 'Orders service', note: 'Old' });
    expect(out.capped).toBe(true);
    expect(out.warnings[0]!.message).toBe('n3 label kept as "Orders service"; the rest was cut');
    const onArrow = write(arrow, { label: 'Orders service which creates and tracks every order' });
    expect(onArrow.warnings[0]!.message).toBe(
      'a1 label kept as "Orders service"; the rest was cut',
    );
  });

  it('refuses element links and notes, which are retired, but keeps a link card and a video their link', () => {
    for (const fields of [{ note: 'x' }, { note: null }, { noteRich: null }, { link: null }] as Fields[])
      expect(refusal(square, fields).details[0]).toContain('element links and notes are retired');
    const url = { kind: 'url', url: 'https://example.com' };
    for (const type of ['link-card', 'video']) {
      const own = { id: 'c', type, x: 0, y: 0, width: 200, height: 100 } as unknown as Element;
      expect(nextOf(write(own, { link: url }))).toMatchObject({ link: url });
    }
  });

  it('refuses identity, live and prototype fields, and keys the type lacks', () => {
    expect(refusal(square, { id: 'x' }).details[0]).toBe('id="x": cannot be changed');
    expect(refusal(square, { [LIVE_ELEMENT_FIELDS[0]]: [] }).code).toBe('invalid_value');
    // JSON.parse makes `__proto__` an own key, which an object literal cannot.
    const proto = JSON.parse('{"__proto__":1}') as Fields;
    expect(refusal(square, proto).code).toBe('unknown_field');
    const unknown = refusal(arrow, { fill: 'red' });
    expect(unknown.details).toEqual([
      'arrow has no field "fill"',
      expect.stringMatching(
        /^fields: label stroke text-color border text line, then id type layerId /,
      ),
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
      ['text="huge": one of sm md lg scale or a px from 24 to 72'],
      ['line="wavy": one of straight angled curved'],
    ]);
    expect(nextOf(write(arrow, { line: 'angled' })).arrowStyle).toBe('angled');
    expect(nextOf(write(arrow, { line: null }))).not.toHaveProperty('arrowStyle');
  });

  it('writes an exact text px from the Text Size slider range, as a number or a numeric string', () => {
    // A text's or a shape's runs a document's 24 to 72 (fonts.md "In livedocuments"), the rest the model's 6 to 48.
    expect(nextOf(write(square, { text: 30 })).textSize).toBe(30);
    expect(nextOf(write(square, { text: '24' })).textSize).toBe(24);
    expect(nextOf(write(text, { text: 48 })).textSize).toBe(48);
    expect(refusal(square, { text: 18 }).details).toEqual([
      'text=18: one of sm md lg scale or a px from 24 to 72',
    ]);
    expect(refusal(text, { text: 73 }).details).toHaveLength(1);
    expect(refusal(square, { text: 30.5 }).details).toHaveLength(1);
    expect(nextOf(write(arrow, { text: '6' })).textSize).toBe(6);
    expect(refusal(arrow, { text: 49 }).details).toEqual([
      'text=49: one of sm md lg scale or a px from 6 to 48',
    ]);
  });

  it("stores a text's px past 48 as 48 and a scale, as the slider does", () => {
    expect(nextOf(write(text, { text: 72 }))).toMatchObject({ textSize: 48, textScale: 1.5 });
    const rescaled = nextOf(write({ ...square, textScale: 0.46 } as Element, { text: 60 }));
    expect(rescaled).toMatchObject({ textSize: 48, textScale: 1.25 });
  });

  it('clears a re-fit or Shift scale with the size it writes (fonts.md "Text size")', () => {
    const scaled = nextOf(write({ ...square, textScale: 0.46 } as Element, { text: 30 }));
    expect(scaled.textSize).toBe(30);
    expect(scaled).not.toHaveProperty('textScale');
    expect(nextOf(write({ ...text, textScale: 2 } as Element, { text: 'md' }))).not.toHaveProperty(
      'textScale',
    );
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
