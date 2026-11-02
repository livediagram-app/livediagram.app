// A PowerPoint deck read into slides of placed items (docs/specs/020-import-export/office-import.md "PowerPoint becomes
// slide pages"; the blueprint's "readPptx" is the precise mapping): text boxes and placeholders as text, pictures as
// pictures, groups opened, each slide's notes and hidden flag. Everything left out is counted for the report. Pure
// over an opened package.

import type { TextAlignX, TextAlignY } from '@liveworkspace/model-core/basics';
import { MAX_ELEMENTS_PER_TAB, MAX_PAGES } from '@livedocuments/document';
import type { OfficePicture } from './docx';
import { OfficeImportError } from './errors';
import { EMU_PER_PX, OFFICE_MAX_SLIDE_ITEMS, OFFICE_NOTES_MAX } from './limits';
import type { OfficePackage, OfficeRel } from './package';
import {
  DEFAULT_SIZE_PT,
  IDENTITY,
  anchorOf,
  boxOf,
  bulletDefault,
  fontScaleOf,
  groupMap,
  inheritedShape,
  listStyleAlignOf,
  listStyleSizeOf,
  masterStyleAlign,
  masterStyleSize,
  placeholderOf,
  readTextBody,
  spTreeOf,
  type EmuBox,
  type GroupMap,
  type Inheritance,
} from './pptx-shapes';
import { addSkip, type SkipTally } from './tally';
import { child, find, intAttr, kids, path, textOf, type XmlElement } from './xml';

export type SlideTextItem = {
  kind: 'text';
  box: EmuBox;
  label: string;
  sizePt: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};
export type SlidePictureItem = { kind: 'picture'; box: EmuBox; picture: OfficePicture };
export type SlideItem = SlideTextItem | SlidePictureItem;

export type PptxSlide = { items: SlideItem[]; notes?: string; hidden?: true };

export type PptxRead = {
  /** The deck's slide size, in EMU. */
  cx: number;
  cy: number;
  slides: PptxSlide[];
  pictures: OfficePicture[];
  tally: SkipTally;
};

// PowerPoint's default 16:9 slide, for a presentation part that names none.
const DEFAULT_CX = 12_192_000;
const DEFAULT_CY = 6_858_000;

type SlideContext = {
  rels: Map<string, OfficeRel>;
  inherit: Inheritance;
  items: SlideItem[];
  pictures: OfficePicture[];
  tally: SkipTally;
  budget: { left: number };
};

function add(ctx: SlideContext, item: SlideItem): void {
  if (ctx.items.length >= OFFICE_MAX_SLIDE_ITEMS || ctx.budget.left <= 0) {
    addSkip(ctx.tally, 'crowded');
    return;
  }
  ctx.budget.left -= 1;
  ctx.items.push(item);
  if (item.kind === 'picture') ctx.pictures.push(item.picture);
}

function textShape(shape: XmlElement, map: GroupMap, ctx: SlideContext): void {
  const ph = placeholderOf(shape);
  const layoutShape = ph ? inheritedShape(spTreeOf(ctx.inherit.layout), ph, true) : undefined;
  const masterShape = ph ? inheritedShape(spTreeOf(ctx.inherit.master), ph, false) : undefined;
  const body = readTextBody(
    child(shape, 'p:txBody'),
    bulletDefault([shape, layoutShape, masterShape], ctx.inherit.master, ph?.type),
  );
  if (!body) {
    // An empty placeholder shows its prompt only while editing; a text-less shape is decoration.
    if (!ph) addSkip(ctx.tally, 'shapes');
    return;
  }
  const own = boxOf(shape);
  const box = own ? map(own) : (boxOf(layoutShape) ?? boxOf(masterShape));
  // No box anywhere: PowerPoint draws it nowhere either (D65).
  if (!box) return;
  const type = ph?.type ?? 'none';
  const sizePt =
    body.sizePt ??
    listStyleSizeOf(shape) ??
    listStyleSizeOf(layoutShape) ??
    listStyleSizeOf(masterShape) ??
    (ph ? masterStyleSize(ctx.inherit.master, ph.type) : undefined) ??
    DEFAULT_SIZE_PT[type];
  add(ctx, {
    kind: 'text',
    box,
    label: body.label,
    sizePt: sizePt * fontScaleOf(shape),
    alignX:
      body.alignX ??
      listStyleAlignOf(shape) ??
      listStyleAlignOf(layoutShape) ??
      listStyleAlignOf(masterShape) ??
      (ph ? masterStyleAlign(ctx.inherit.master, ph.type) : undefined) ??
      'left',
    alignY: anchorOf(shape) ?? anchorOf(layoutShape) ?? anchorOf(masterShape) ?? 'top',
    bold: body.bold,
    italic: body.italic,
    underline: body.underline,
  });
}

function pictureShape(pic: XmlElement, map: GroupMap, ctx: SlideContext): void {
  const nvPr = path(pic, 'p:nvPicPr', 'p:nvPr');
  if (child(nvPr, 'a:videoFile') || child(nvPr, 'a:audioFile') || find(nvPr, 'p14:media')) {
    addSkip(ctx.tally, 'media');
    return;
  }
  const own = boxOf(pic);
  if (!own) return;
  const blipFill = child(pic, 'p:blipFill');
  const blip = child(blipFill, 'a:blip');
  const embed = blip?.attrs['r:embed'];
  const rel = embed ? ctx.rels.get(embed) : undefined;
  if (!rel || rel.external) {
    addSkip(ctx.tally, 'linkedImages');
    return;
  }
  const box = map(own);
  const crop = child(blipFill, 'a:srcRect');
  const cropped = !!crop && ['l', 't', 'r', 'b'].some((k) => (intAttr(crop, k) ?? 0) !== 0);
  const cNvPr = path(pic, 'p:nvPicPr', 'p:cNvPr');
  const alt = (cNvPr?.attrs.descr || '').trim();
  add(ctx, {
    kind: 'picture',
    box,
    picture: {
      path: rel.target,
      widthPx: Math.round(box.cx / EMU_PER_PX),
      heightPx: Math.round(box.cy / EMU_PER_PX),
      ...(alt ? { alt } : {}),
      ...(cropped ? { cropped: true as const } : {}),
    },
  });
}

function graphicFrame(frame: XmlElement, ctx: SlideContext): void {
  const uri = find(frame, 'a:graphicData')?.attrs.uri ?? '';
  if (uri.endsWith('/table')) addSkip(ctx.tally, 'tables');
  else if (uri.endsWith('/chart')) addSkip(ctx.tally, 'charts');
  else if (uri.endsWith('/diagram')) addSkip(ctx.tally, 'diagrams');
  else addSkip(ctx.tally, 'embedded');
}

function shapes(tree: XmlElement | undefined, map: GroupMap, ctx: SlideContext): void {
  for (const el of kids(tree)) {
    switch (el.name) {
      case 'p:sp':
        textShape(el, map, ctx);
        break;
      case 'p:pic':
        pictureShape(el, map, ctx);
        break;
      case 'p:grpSp':
        shapes(el, groupMap(el, map), ctx);
        break;
      case 'p:graphicFrame':
        graphicFrame(el, ctx);
        break;
      case 'p:cxnSp':
      case 'p:contentPart':
        addSkip(ctx.tally, 'shapes');
        break;
      case 'mc:AlternateContent':
        shapes(child(el, 'mc:Choice'), map, ctx);
        break;
    }
  }
}

/** A notes slide's body text, its lines joined, cut at OFFICE_NOTES_MAX. */
function notesText(notes: XmlElement | undefined): string | undefined {
  const tree = spTreeOf(notes);
  const body = kids(tree).find((s) => s.name === 'p:sp' && placeholderOf(s)?.rawType === 'body');
  if (!body) return undefined;
  const lines = kids(child(body, 'p:txBody'))
    .filter((p) => p.name === 'a:p')
    .map((p) =>
      kids(p)
        .map((r) => (r.name === 'a:br' ? '\n' : textOf(child(r, 'a:t'))))
        .join(''),
    );
  const text = lines.join('\n').trim();
  return text ? text.slice(0, OFFICE_NOTES_MAX) : undefined;
}

const relOfType = (rels: Map<string, OfficeRel>, type: string) =>
  [...rels.values()].find((r) => r.type === type && !r.external);

export async function readPptx(pkg: OfficePackage): Promise<PptxRead> {
  const presentation = await pkg.readXml(pkg.mainPath);
  const presRels = await pkg.rels(pkg.mainPath);
  const size = child(presentation, 'p:sldSz');
  const cx = intAttr(size, 'cx') ?? DEFAULT_CX;
  const cy = intAttr(size, 'cy') ?? DEFAULT_CY;
  const ids = kids(child(presentation, 'p:sldIdLst')).filter((s) => s.name === 'p:sldId');
  if (ids.length > MAX_PAGES) throw new OfficeImportError('too-many-slides', ids.length);

  // Layouts and masters are shared by many slides: each read once.
  const inheritCache = new Map<string, Promise<Inheritance>>();
  const inheritanceOf = (layoutPath: string): Promise<Inheritance> => {
    let hit = inheritCache.get(layoutPath);
    if (!hit) {
      hit = (async () => {
        const layout = await pkg.readXml(layoutPath);
        const masterRel = relOfType(await pkg.rels(layoutPath), 'slideMaster');
        const master = masterRel ? await pkg.readXml(masterRel.target) : undefined;
        return { layout, master };
      })();
      inheritCache.set(layoutPath, hit);
    }
    return hit;
  };

  const tally: SkipTally = {};
  const pictures: OfficePicture[] = [];
  const slides: PptxSlide[] = [];
  const budget = { left: MAX_ELEMENTS_PER_TAB };
  for (const id of ids) {
    const rel = presRels.get(id.attrs['r:id'] ?? '');
    if (!rel || rel.external) continue;
    const slide = await pkg.readXml(rel.target);
    if (!slide) continue;
    const rels = await pkg.rels(rel.target);
    const layoutRel = relOfType(rels, 'slideLayout');
    const inherit = layoutRel ? await inheritanceOf(layoutRel.target) : {};
    const ctx: SlideContext = { rels, inherit, items: [], pictures, tally, budget };
    shapes(spTreeOf(slide), IDENTITY, ctx);
    const notesRel = relOfType(rels, 'notesSlide');
    const notes = notesRel ? notesText(await pkg.readXml(notesRel.target)) : undefined;
    slides.push({
      items: ctx.items,
      ...(notes ? { notes } : {}),
      ...(slide.attrs.show === '0' || slide.attrs.show === 'false'
        ? { hidden: true as const }
        : {}),
    });
  }
  return { cx: cx > 0 ? cx : DEFAULT_CX, cy: cy > 0 ? cy : DEFAULT_CY, slides, pictures, tally };
}
