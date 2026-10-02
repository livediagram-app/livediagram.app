// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ReportTally } from './notes';
import { readGraph } from './cells';
import { parseStyle } from './style';
import { model } from './test-support';
import {
  boxedProps,
  dashStyle,
  elementLink,
  fontIdFor,
  inkOnFill,
  radiusPreset,
  strokePreset,
  textProps,
  type ConvertContext,
} from './vertex-props';

const ctx = (): ConvertContext => ({
  tally: new ReportTally(),
  pageIdToTab: new Map([['p2', 'tab-2']]),
});

const cellFrom = (xml: string, id = 'v') => readGraph(model(xml)).cells.get(id)!;
const cell = (style: string, value = '', extra = '') =>
  cellFrom(
    `<mxCell id="v" style="${style}" value="${value}" vertex="1" parent="1" ${extra}><mxGeometry width="100" height="60" as="geometry"/></mxCell>`,
  );

describe('strokePreset', () => {
  it('maps px to the nearest preset, thinner on a tie, 1 px when absent', () => {
    expect(strokePreset(undefined)).toBe('thin');
    expect(strokePreset(0)).toBe('none');
    expect(strokePreset(1)).toBe('thin');
    expect(strokePreset(1.5)).toBe('thin');
    expect(strokePreset(2)).toBe('medium');
    expect(strokePreset(3)).toBe('medium');
    expect(strokePreset(4)).toBe('thick');
    expect(strokePreset(12)).toBe('extra-thick');
  });
});

describe('dashStyle', () => {
  it('reads dashed and dotted patterns', () => {
    expect(dashStyle(parseStyle('', false))).toBeUndefined();
    expect(dashStyle(parseStyle('dashed=1;', false))).toBe('dashed');
    expect(dashStyle(parseStyle('dashed=1;dashPattern=8 8;', false))).toBe('dotted');
    expect(dashStyle(parseStyle('dashed=1;dashPattern=1 4;', false))).toBe('dotted');
    expect(dashStyle(parseStyle('dashed=1;dashPattern=12 4;', false))).toBe('dashed');
  });
});

describe('radiusPreset', () => {
  it('turns arcSize into the nearest corner preset', () => {
    expect(radiusPreset(parseStyle('rounded=0;', false), 120, 60)).toBe('none');
    expect(radiusPreset(parseStyle('rounded=1;', false), 120, 60)).toBe('sm');
    expect(radiusPreset(parseStyle('rounded=1;arcSize=20;', false), 120, 60)).toBe('md');
    expect(radiusPreset(parseStyle('rounded=1;arcSize=50;', false), 120, 60)).toBe('full');
    expect(
      radiusPreset(parseStyle('rounded=1;absoluteArcSize=1;arcSize=24;', false), 120, 60),
    ).toBe('lg');
  });
});

describe('fontIdFor', () => {
  it('maps families by name and by kind', () => {
    expect(fontIdFor('Helvetica')).toBeUndefined();
    expect(fontIdFor(undefined)).toBeUndefined();
    expect(fontIdFor('Courier New')).toBe('roboto-mono');
    expect(fontIdFor('"Architects Daughter"')).toBe('caveat');
    expect(fontIdFor('Lora, serif')).toBe('lora');
  });
});

describe('elementLink', () => {
  it('keeps web and mail links, maps page links, drops the rest', () => {
    const c = ctx();
    expect(elementLink('https://x.test', c)).toEqual({ kind: 'url', url: 'https://x.test' });
    expect(elementLink('mailto:a@b.test', c)).toEqual({ kind: 'url', url: 'mailto:a@b.test' });
    expect(elementLink('data:page/id,p2', c)).toEqual({ kind: 'tab', tabId: 'tab-2' });
    expect(elementLink('data:page/id,gone', c)).toBeUndefined();
    expect(elementLink('javascript:alert(1)', c)).toBeUndefined();
    expect(elementLink(undefined, c)).toBeUndefined();
    expect(c.tally.notes()).toEqual([{ kind: 'link-dropped', count: 2 }]);
  });
});

describe('boxedProps', () => {
  it('maps colours, stroke, opacity, rotation, shadow and lock', () => {
    const p = boxedProps(
      cell(
        'fillColor=#DAE8FC;strokeColor=#6c8ebf;strokeWidth=2;dashed=1;opacity=60;rotation=375;shadow=1;locked=1;',
      ),
      ctx(),
    );
    expect(p).toEqual({
      fillColor: '#dae8fc',
      strokeColor: '#6c8ebf',
      strokeWidth: 'medium',
      strokeStyle: 'dashed',
      opacity: 0.6,
      rotation: 15,
      shadow: { offsetX: 2, offsetY: 3, blur: 3, opacity: 0.25 },
      locked: true,
    });
  });

  it('leaves default colours to the theme, and none as transparent / no stroke', () => {
    expect(boxedProps(cell('fillColor=default;'), ctx())).toEqual({ strokeWidth: 'thin' });
    expect(boxedProps(cell('fillColor=none;strokeColor=none;'), ctx())).toEqual({
      fillColor: 'transparent',
      strokeWidth: 'none',
    });
  });

  it('carries tooltip and properties as a note, and the link', () => {
    const c = cellFrom(
      '<UserObject id="v" label="x" tooltip="Hover" owner="Ops" link="https://x.test"><mxCell vertex="1" parent="1"><mxGeometry width="1" height="1" as="geometry"/></mxCell></UserObject>',
    );
    expect(boxedProps(c, ctx())).toMatchObject({
      note: 'Hover\nowner: Ops',
      link: { kind: 'url', url: 'https://x.test' },
    });
  });
});

describe('inkOnFill', () => {
  it('picks ink that reads on the fill, and none without one', () => {
    expect(inkOnFill('#fff2cc')).toBe('#1e293b');
    expect(inkOnFill('#036897')).toBe('#ffffff');
    expect(inkOnFill('transparent')).toBeUndefined();
    expect(inkOnFill(undefined)).toBeUndefined();
  });
});

describe('textProps', () => {
  const opts = { scale: 'label' as const, rich: true, outsideMovesIn: true };

  it('maps text, font style bits, colour, size, font and alignment', () => {
    const t = textProps(
      cell(
        'fontStyle=7;fontColor=#333333;fontSize=28;fontFamily=Courier New;align=left;verticalAlign=top;',
        'Hi',
      ),
      ctx(),
      opts,
    );
    expect(t).toEqual({
      label: 'Hi',
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textColor: '#333333',
      textSize: 'lg',
      font: 'roboto-mono',
      textAlignX: 'left',
      textAlignY: 'top',
    });
  });

  it('carries rich runs only where the kind has them', () => {
    const c = cell('html=1;', 'a &lt;b&gt;b&lt;/b&gt;');
    expect(textProps(c, ctx(), opts).richText).toEqual([{ text: 'a ' }, { text: 'b', bold: true }]);
    expect(textProps(c, ctx(), { ...opts, rich: false }).richText).toBeUndefined();
  });

  it('moves an outside label in, towards its side, and counts it', () => {
    const c = ctx();
    const t = textProps(cell('verticalLabelPosition=bottom;verticalAlign=top;', 'Below'), c, opts);
    expect(t).toMatchObject({ textAlignY: 'bottom' });
    expect(c.tally.notes()).toEqual([{ kind: 'label-moved', count: 1 }]);
    const empty = ctx();
    textProps(cell('labelPosition=right;'), empty, opts);
    expect(empty.tally.notes()).toEqual([]);
  });

  it('gives an uncoloured label on an own fill legible ink, but never overrides a colour', () => {
    const onFill = { ...opts, onFill: '#fff2cc' };
    expect(textProps(cell('', 'Hi'), ctx(), onFill).textColor).toBe('#1e293b');
    expect(textProps(cell('fontColor=#ff0000;', 'Hi'), ctx(), onFill).textColor).toBe('#ff0000');
    expect(textProps(cell(''), ctx(), onFill).textColor).toBeUndefined();
  });

  it('defaults to draw.io 12 px, centred', () => {
    expect(textProps(cell(''), ctx(), opts)).toEqual({
      textSize: 'sm',
      textAlignX: 'center',
      textAlignY: 'middle',
    });
  });
});
