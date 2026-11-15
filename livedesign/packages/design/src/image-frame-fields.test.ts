import { describe, expect, it } from 'vitest';
import { createImage } from './factories';
import { elementValidationIssue } from './validate';
import { renderElementsToSvg } from './svg-render';
import { participantTabChange } from './participant-content';
import type { Element } from './index';

// docs/specs/009-elements/picture-crop-and-mask.md: crop, mask and greyscale on a livedesign picture, refused on the
// write paths and drawn by the design's SVG export. The shared rules are tested in @liveworkspace/element-model.
describe('validation', () => {
  const img = { ...createImage(0, 0), imageId: 'abc' };
  it('accepts the three fields and names a bad one', () => {
    expect(
      elementValidationIssue({
        ...img,
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
        mask: 'circle',
        greyscale: true,
      }),
    ).toBeNull();
    expect(
      elementValidationIssue({ ...img, crop: { x: 0.9, y: 0, width: 0.5, height: 1 } })?.field,
    ).toBe('crop');
    expect(elementValidationIssue({ ...img, mask: 'heart' })?.field).toBe('mask');
    expect(elementValidationIssue({ ...img, greyscale: 'yes' })?.field).toBe('greyscale');
  });
});

describe('SVG export', () => {
  const href = 'data:image/png;base64,AAAA';
  const draw = (patch: Record<string, unknown>) =>
    renderElementsToSvg(
      {
        id: 't',
        name: 'T',
        elements: [
          {
            ...createImage(10, 20),
            id: 'pic',
            imageId: 'abc',
            width: 100,
            height: 100,
            naturalWidth: 400,
            naturalHeight: 200,
            ...patch,
          },
        ],
      },
      { resolveImageHref: () => href },
    );

  it('clips a masked picture to its path and covers it', () => {
    const svg = draw({ mask: 'diamond' });
    expect(svg).toContain('<clipPath id="lvd-img-pic"><path d="M60 20L110 70L60 120L10 70Z"/>');
    expect(svg).toContain('preserveAspectRatio="none"');
    // Cover: the 400 x 200 picture scales to 200 x 100, centred on the box.
    expect(svg).toContain('x="-40" y="20" width="200" height="100"');
  });

  it('draws a crop at its laid-out place, a letterboxed one inside its part', () => {
    const svg = draw({ crop: { x: 0, y: 0, width: 1, height: 1 } });
    expect(svg).toContain('lvd-img-pic-part');
    const half = draw({ crop: { x: 0.5, y: 0, width: 0.5, height: 1 } });
    expect(half).not.toContain('lvd-img-pic-part');
    expect(half).toContain('x="-90" y="20" width="200" height="100"');
  });

  it('greys a picture with a colour matrix, cropped or not', () => {
    expect(draw({ greyscale: true })).toContain('<feColorMatrix type="matrix" values="0.2126');
    expect(draw({ greyscale: true })).toContain('filter="url(#lvd-img-pic-grey)"');
    expect(draw({ greyscale: true, mask: 'circle' })).toContain('filter="url(#lvd-img-pic-grey)"');
    expect(draw({})).not.toContain('feColorMatrix');
  });

  it('draws a plain picture as before', () => {
    const plain = draw({});
    expect(plain).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(plain).toContain('<clipPath id="lvd-img-pic"><rect ');
  });
});

// "Share roles": crop, mask and greyscale are an Editor's; a Participant's change to any of them is refused whole.
describe('a Participant', () => {
  const pic = { ...createImage(0, 0), id: 'pic', imageId: 'abc' } as Element;
  const tab = (el: Element) => ({ id: 't', name: 'T', elements: [el] });
  it.each([
    ['crop', { crop: { x: 0, y: 0, width: 0.5, height: 1 } }],
    ['mask', { mask: 'circle' }],
    ['greyscale', { greyscale: true }],
  ])('may not change %s', (_field, patch) => {
    expect(
      participantTabChange(tab(pic), tab({ ...pic, ...patch } as Element), 'a'.repeat(32)),
    ).toBeNull();
  });
});
