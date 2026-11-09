// The Logo Strip slide (docs/specs/009-elements/logo-strip.md "Slide layout"): an eyebrow, a title and a line, then
// six greyscale logos evenly spaced across the slide, centred in its lower half. The strip is a stack of image
// placeholders (createLogoStrip), so dropping logos in keeps them in line.
import { createLogoStrip, LOGO_STRIP_PADDING, type Element } from '@livedocuments/document';
import type { Kit } from './page-layout-kit';
import { eyebrow, slideType } from './slide-layout-kit';

const LOGOS = 6;

export function logoStripSlide(k: Kit): Element[] {
  const { box, u } = k;
  const top = u * 8;
  const w = box.width * 0.86;
  const logoH = u * 12;
  const h = logoH + LOGO_STRIP_PADDING * 2;
  const lowerTop = box.height / 2;
  const y = box.y + lowerTop + (box.height - lowerTop - h) / 2;
  return [
    eyebrow(k, 0, 0, w, 'TRUSTED BY'),
    k.title(0, top, w, u * 11, 'Teams everywhere build with us'),
    k.text(
      0,
      top + u * 12.5,
      w,
      u * 8,
      'Hundreds of teams plan, write and present here.',
      slideType(k, 4),
    ),
    ...createLogoStrip({ x: box.x, y, width: box.width, height: h }, LOGOS),
  ];
}
