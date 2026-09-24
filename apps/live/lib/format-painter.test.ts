import type { ArrowElement, BoxedElement, TextRun } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { applyPaint, paintableArrowFields, paintableBoxedFields } from './format-painter';

// Fully-populated source shapes / arrows so the painter has something
// for every field. The painter's whole job is to be specific about
// which fields travel, so the tests are equally specific.

const fullyStyledShape: BoxedElement = {
  id: 'src',
  type: 'shape',
  shape: 'square',
  x: 100,
  y: 200,
  width: 180,
  height: 90,
  aspectLocked: true,
  opacity: 0.7,
  fillColor: '#ff00ff',
  shadow: { offsetX: 2, offsetY: 6, blur: 10, opacity: 0.3 },
  strokeColor: '#003366',
  textColor: '#222222',
  textSize: 'lg',
  textAlignX: 'left',
  textAlignY: 'bottom',
  textBold: true,
  textItalic: true,
  textUnderline: true,
  textStrikethrough: true,
  font: 'caveat',
  padding: 'lg',
  strokeWidth: 'thick',
  strokeStyle: 'dashed',
  borderRadius: 'lg',
  // Identity / content fields the painter must NOT copy.
  label: 'Source label',
  groupId: 'g1',
  locked: true,
};

const fullyStyledArrow: ArrowElement = {
  id: 'arr',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 100 },
  strokeColor: '#0ea5e9',
  strokeWidth: 3,
  strokeStyle: 'dashed',
  opacity: 0.5,
  arrowEnds: 'both',
  arrowheadSize: 'large',
  arrowheadShape: 'triangle-hollow',
  arrowStyle: 'curved',
  textColor: '#222222',
  textSize: 'lg',
  textBold: true,
  textItalic: true,
  textUnderline: true,
  textStrikethrough: true,
  font: 'caveat',
  label: 'Arrow label',
  locked: true,
};

describe('paintableBoxedFields', () => {
  it('carries every visual styling field from the source', () => {
    const out = paintableBoxedFields(fullyStyledShape);
    expect(out).toEqual({
      width: 180,
      height: 90,
      aspectLocked: true,
      opacity: 0.7,
      fillColor: '#ff00ff',
      shadow: { offsetX: 2, offsetY: 6, blur: 10, opacity: 0.3 },
      strokeColor: '#003366',
      textColor: '#222222',
      textSize: 'lg',
      textAlignX: 'left',
      textAlignY: 'bottom',
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textStrikethrough: true,
      font: 'caveat',
      padding: 'lg',
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      borderRadius: 'lg',
    });
  });

  it('carries the icon fields (glyph animation + speed, Technology mark size)', () => {
    const out = paintableBoxedFields({
      id: 'i',
      type: 'shape',
      shape: 'icon',
      iconId: 'aws-ec2',
      x: 0,
      y: 0,
      width: 128,
      height: 128,
      iconAnimation: 'spin',
      iconAnimationSpeed: 'fast',
      iconSize: 'xl',
    });
    // The union's Partial hides shape-only fields; read structurally.
    const icon = out as { iconAnimation?: string; iconAnimationSpeed?: string; iconSize?: string };
    expect(icon.iconAnimation).toBe('spin');
    expect(icon.iconAnimationSpeed).toBe('fast');
    expect(icon.iconSize).toBe('xl');
    // Identity stays with the target: the glyph itself is never painted.
    expect(out).not.toHaveProperty('iconId');
  });

  it('omits identity, content and position fields so the target keeps its own', () => {
    const out = paintableBoxedFields(fullyStyledShape) as Record<string, unknown>;
    // Identity / position / content stay on the target — the painter
    // must never overwrite them.
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('type');
    expect(out).not.toHaveProperty('shape');
    expect(out).not.toHaveProperty('x');
    expect(out).not.toHaveProperty('y');
    expect(out).not.toHaveProperty('label');
    expect(out).not.toHaveProperty('groupId');
    expect(out).not.toHaveProperty('locked');
  });

  it('names every field the source is on the default for, so the paint can reset it', () => {
    // A bare-default source still has an opinion on every field its kind
    // carries: "the default". Those travel as `undefined` keys, which
    // applyPaint turns into a cleared override on the target.
    const sparse: BoxedElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    };
    const out = paintableBoxedFields(sparse);
    expect(out.width).toBe(100);
    expect(out).toHaveProperty('fillColor', undefined);
    expect(out).toHaveProperty('shadow', undefined);
    expect(out).toHaveProperty('strokeWidth', undefined);
  });

  it('leaves out fields the source kind never draws, so the target keeps its own', () => {
    const text: BoxedElement = { id: 't', type: 'text', x: 0, y: 0, width: 100, height: 40 };
    const out = paintableBoxedFields(text);
    // A text element has no border presets and no shadow: no opinion.
    expect(out).not.toHaveProperty('strokeWidth');
    expect(out).not.toHaveProperty('borderRadius');
    expect(out).not.toHaveProperty('shadow');
    expect(out).not.toHaveProperty('colorPreset');
  });

  it('carries an image’s animation along with its size, opacity and shadow', () => {
    const image: BoxedElement = {
      id: 'img',
      type: 'image',
      imageId: 'x',
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      animation: 'pulse',
    };
    const out = paintableBoxedFields(image);
    expect(out.animation).toBe('pulse');
    expect(out).toHaveProperty('shadow', undefined);
    // Images draw no text or colour, so they hold no opinion on either.
    expect(out).not.toHaveProperty('fillColor');
    expect(out).not.toHaveProperty('textColor');
  });

  it('carries a table’s header fill and header text colour', () => {
    const table = {
      id: 'tb',
      type: 'table',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      cells: [['a']],
      headerFill: '#123456',
      headerTextColor: '#ffffff',
    } as BoxedElement;
    const out = paintableBoxedFields(table) as Record<string, unknown>;
    expect(out.headerFill).toBe('#123456');
    expect(out.headerTextColor).toBe('#ffffff');
  });

  it('collapses a uniform richText label into whole-label text formatting', () => {
    // Select-all-bold stores the formatting in a single attributed run,
    // not the element-level flag — the painter must still carry it.
    const richSource: BoxedElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      label: 'Hello world',
      richText: [{ text: 'Hello world', bold: true, color: '#ff0000', size: 'lg' }],
    };
    const out = paintableBoxedFields(richSource);
    expect(out.textBold).toBe(true);
    expect(out.textColor).toBe('#ff0000');
    expect(out.textSize).toBe('lg');
    // richText itself is bound to the source's characters, never painted.
    expect(out).not.toHaveProperty('richText');
  });

  it('does not paint an attribute the richText runs disagree on', () => {
    const mixedSource: BoxedElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      label: 'Hi there',
      // Only the first run is bold — there's no single whole-label value.
      richText: [{ text: 'Hi ', bold: true }, { text: 'there' }],
    };
    const out = paintableBoxedFields(mixedSource);
    // No single value, so the element field (unset here) is what travels.
    expect(out.textBold).toBeUndefined();
  });
});

describe('paintableArrowFields', () => {
  it('carries stroke, width, pattern, opacity, arrowEnds and label text styling from the source arrow', () => {
    const out = paintableArrowFields(fullyStyledArrow);
    expect(out).toEqual({
      strokeColor: '#0ea5e9',
      strokeWidth: 3,
      strokeStyle: 'dashed',
      opacity: 0.5,
      arrowEnds: 'both',
      arrowheadSize: 'large',
      arrowheadShape: 'triangle-hollow',
      arrowStyle: 'curved',
      textColor: '#222222',
      textSize: 'lg',
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textStrikethrough: true,
      font: 'caveat',
    });
  });

  it('omits identity, endpoints, label and locked so the target keeps its own', () => {
    const out = paintableArrowFields(fullyStyledArrow) as Record<string, unknown>;
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('type');
    expect(out).not.toHaveProperty('from');
    expect(out).not.toHaveProperty('to');
    expect(out).not.toHaveProperty('label');
    expect(out).not.toHaveProperty('locked');
  });

  it('carries the arrowhead colour and the label plate', () => {
    const out = paintableArrowFields({
      ...fullyStyledArrow,
      arrowheadColor: '#ff0000',
      labelFill: '#ffffff',
    });
    expect(out.arrowheadColor).toBe('#ff0000');
    expect(out.labelFill).toBe('#ffffff');
  });
});

describe('applyPaint', () => {
  const bareArrow: ArrowElement = {
    id: 'a',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 10, y: 10 },
  };

  it('resets a coloured arrow when the source arrow is on the theme colour', () => {
    // The reported bug: a default-coloured source left the target red.
    const red: ArrowElement = { ...bareArrow, id: 'b', strokeColor: '#ff0000', strokeWidth: 4 };
    const out = applyPaint(red, paintableArrowFields(bareArrow));
    expect(out).not.toHaveProperty('strokeColor');
    expect(out).not.toHaveProperty('strokeWidth');
    // Identity and geometry stay the target's.
    expect(out.id).toBe('b');
    expect(out.from).toEqual(red.from);
  });

  it('sets the colours a styled source carries', () => {
    const out = applyPaint(bareArrow, paintableArrowFields(fullyStyledArrow));
    expect(out.strokeColor).toBe('#0ea5e9');
    expect(out.arrowStyle).toBe('curved');
  });

  it('keeps the target’s border when the source kind has none', () => {
    const text: BoxedElement = { id: 't', type: 'text', x: 0, y: 0, width: 100, height: 40 };
    const out = applyPaint(fullyStyledShape, paintableBoxedFields(text)) as Record<string, unknown>;
    expect(out.strokeWidth).toBe('thick');
    expect(out.shadow).toEqual(fullyStyledShape.shadow);
    // ...but its fill follows the text element's default.
    expect(out).not.toHaveProperty('fillColor');
  });

  it('strips painted attributes from the target’s runs so the paint shows', () => {
    const target: BoxedElement = {
      id: 't',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      label: 'Hello there',
      richText: [
        { text: 'Hello ', bold: true, color: '#ff0000' },
        { text: 'there', link: 'https://example.com' },
      ],
    };
    const out = applyPaint(target, { textBold: false, textColor: '#00ff00' }) as {
      richText?: TextRun[];
      textBold?: boolean;
    };
    expect(out.textBold).toBe(false);
    // Bold + colour lost to the paint; the link is content and stays.
    expect(out.richText).toEqual([
      { text: 'Hello ' },
      { text: 'there', link: 'https://example.com' },
    ]);
  });

  it('drops richText entirely once nothing rich is left', () => {
    const target: BoxedElement = {
      id: 't',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      label: 'Hi',
      richText: [{ text: 'Hi', bold: true }],
    };
    const out = applyPaint(target, { textBold: true });
    expect(out).not.toHaveProperty('richText');
    expect(out.textBold).toBe(true);
  });

  it('leaves the runs alone when no text is painted', () => {
    const runs: TextRun[] = [{ text: 'Hi', bold: true }];
    const target = { ...fullyStyledShape, richText: runs } as BoxedElement;
    const out = applyPaint(target, { width: 10 }) as { richText?: TextRun[] };
    expect(out.richText).toEqual(runs);
  });

  describe('the colour-preset binding', () => {
    const bound = { ...fullyStyledShape, colorPreset: 'bold' } as BoxedElement;

    it('copies the source binding when all three colours travel', () => {
      const out = applyPaint(fullyStyledShape, {
        fillColor: '#1',
        strokeColor: '#2',
        textColor: '#3',
        colorPreset: 'soft',
      } as Partial<BoxedElement>) as { colorPreset?: string };
      expect(out.colorPreset).toBe('soft');
    });

    it('clears the target binding when the source has none', () => {
      const out = applyPaint(bound, paintableBoxedFields(fullyStyledShape));
      expect(out).not.toHaveProperty('colorPreset');
    });

    it('clears the target binding on a partial colour paint', () => {
      // Only the stroke travelled; a theme change must not re-derive it away.
      const out = applyPaint(bound, { strokeColor: '#000' });
      expect(out).not.toHaveProperty('colorPreset');
    });

    it('keeps the target binding when no colour is painted', () => {
      const out = applyPaint(bound, { width: 10 }) as { colorPreset?: string };
      expect(out.colorPreset).toBe('bold');
    });
  });
});
