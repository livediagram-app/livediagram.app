import { describe, expect, it } from 'vitest';
import { bodyFitOf } from './pptx-shapes';
import { parseXml } from './xml';

const shape = (bodyPr: string) =>
  parseXml(`<p:sp xmlns:p="p" xmlns:a="a"><p:txBody>${bodyPr}</p:txBody></p:sp>`);

// docs/specs/020-import-export/office-import.md "Text boxes and placeholders": wrap and autofit come from the shape,
// else its layout's, else its master's.
describe('bodyFitOf', () => {
  it('reads wrap="none" and spAutoFit from the shape', () => {
    expect(bodyFitOf([shape('<a:bodyPr wrap="none"><a:spAutoFit/></a:bodyPr>')])).toEqual({
      noWrap: true,
      autoFit: true,
    });
    expect(bodyFitOf([shape('<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>')])).toEqual({
      noWrap: false,
      autoFit: false,
    });
  });

  it('takes what the shape leaves unsaid from its layout, then its master, else wraps and stays fixed', () => {
    const layout = shape('<a:bodyPr wrap="none"/>');
    const master = shape('<a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr>');
    expect(bodyFitOf([shape('<a:bodyPr/>'), layout, master])).toEqual({
      noWrap: true,
      autoFit: true,
    });
    expect(bodyFitOf([shape('<a:bodyPr><a:normAutofit/></a:bodyPr>'), master])).toEqual({
      noWrap: false,
      autoFit: false,
    });
    expect(bodyFitOf([undefined, parseXml('<p:sp xmlns:p="p"/>')])).toEqual({
      noWrap: false,
      autoFit: false,
    });
  });
});
