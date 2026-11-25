// A Page Design tile's and preview's markup (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): the
// design's still frame on a page of the palette's paper, drawn at a slide's scale and shown smaller, so a tile is the
// design as a page wears it. Builder markup: every value is a number or a palette hex.
import {
  designGuard,
  designPalette,
  paintPageDesign,
  pageDesignSvg,
  resolveFontStack,
  resolveTuning,
  tuningForRole,
  type DesignTheme,
  type Element,
  type PageBackground,
  type PageDesign,
  type PageDesignRole,
  type PageRect,
} from '@livedocuments/document';

// Tiles draw a 16:10 page at this size (the unit the designs scale by, as on a 1280 px wide page).
export const TILE_W = 1280;
export const TILE_H = 800;

export type DesignTileInput = {
  design: PageDesign;
  theme: DesignTheme;
  paperDark: boolean;
  background?: PageBackground;
  font?: string;
  width?: number;
  height?: number;
  role?: PageDesignRole;
  // Texts to judge and lay scrims for (the preview's page), with the page's place among them.
  elements?: readonly Element[];
  rect?: PageRect;
  idPrefix: string;
};

/** The tile's SVG and the texts that would not read on it. */
export function designTileSvg(input: DesignTileInput): {
  svg: string;
  failing: number;
  scrimmed: number;
} {
  const w = input.width ?? TILE_W;
  const h = input.height ?? TILE_H;
  const tuning = tuningForRole(resolveTuning(input.design), input.role ?? 'title');
  const palette = designPalette(
    input.theme,
    { background: input.background },
    input.paperDark,
    tuning.colors,
  );
  const font = resolveFontStack(input.font);
  const painted = paintPageDesign({
    design: input.design,
    tuning,
    palette,
    width: w,
    height: h,
    ...(font ? { font } : {}),
  });
  const rect: PageRect = input.rect ?? { x: 0, y: 0, width: w, height: h };
  const guard = input.elements ? designGuard(painted, rect, input.elements) : undefined;
  const fill = input.background?.fill;
  const paper =
    fill?.kind === 'solid' ? fill.color : fill?.kind === 'gradient' ? undefined : palette.base;
  const gradient =
    fill?.kind === 'gradient'
      ? `<defs><linearGradient id="${input.idPrefix}bg" gradientTransform="rotate(${fill.angle - 90} .5 .5)"><stop offset="0" stop-color="${fill.from}"/><stop offset="1" stop-color="${fill.to}"/></linearGradient></defs>` +
        `<rect width="${w}" height="${h}" fill="url(#${input.idPrefix}bg)"/>`
      : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" focusable="false">` +
    (paper ? `<rect width="${w}" height="${h}" fill="${paper}"/>` : gradient) +
    pageDesignSvg(painted, { x: 0, y: 0 }, guard?.scrims ?? [], input.idPrefix) +
    `</svg>`;
  return { svg, failing: guard?.failing.length ?? 0, scrimmed: guard?.scrims.length ?? 0 };
}
