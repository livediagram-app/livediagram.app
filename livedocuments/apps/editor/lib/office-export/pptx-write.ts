// A deck written as a `.pptx` (docs/specs/020-import-export/blueprints/office-export.md "writePptx"): the fixed
// parts, then a slide part per slide with its relationships (its layout, its pictures, its notes slide), each
// picture's PNG a media part of its own. Pure: the deck is already in the file's units.

import {
  APP_PROPS_TYPE,
  appPropsXml,
  CORE_PROPS_TYPE,
  corePropsXml,
  REL,
  relsPathFor,
  relsXml,
  writeOoxmlPackage,
  type OoxmlPart,
  type OoxmlRel,
} from './ooxml';
import { THEME_TYPE, THEME_XML } from './ooxml-theme';
import {
  notesMasterXml,
  presentationXml,
  PPTX_TYPES,
  PRES_PROPS_XML,
  slideLayoutXml,
  slideMasterXml,
  TABLE_STYLES_XML,
  VIEW_PROPS_XML,
} from './pptx-parts';
import { notesSlideXml, slideXml } from './pptx-slide-xml';
import type { PptxDeck } from './pptx-types';

const MASTER = 'ppt/slideMasters/slideMaster1.xml';
const LAYOUT = 'ppt/slideLayouts/slideLayout1.xml';
const NOTES_MASTER = 'ppt/notesMasters/notesMaster1.xml';

export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function withRels(parts: OoxmlPart[], partPath: string, rels: OoxmlRel[]): void {
  parts.push({ path: relsPathFor(partPath), xml: relsXml(rels) });
}

/** The deck's bytes. */
export function writePptx(deck: PptxDeck, when: Date = new Date()): Uint8Array<ArrayBuffer> {
  const parts: OoxmlPart[] = [];
  withRels(parts, '', [
    { id: 'rId1', type: REL.officeDocument, target: 'ppt/presentation.xml' },
    { id: 'rId2', type: REL.coreProps, target: 'docProps/core.xml' },
    { id: 'rId3', type: REL.extendedProps, target: 'docProps/app.xml' },
  ]);
  parts.push(
    { path: 'docProps/core.xml', xml: corePropsXml(deck.title, when), type: CORE_PROPS_TYPE },
    { path: 'docProps/app.xml', xml: appPropsXml(), type: APP_PROPS_TYPE },
  );

  // The presentation's relationships: master, notes master, the slides, then the properties and theme.
  const slideRids = deck.slides.map((_, i) => `rId${i + 3}`);
  const after = deck.slides.length + 3;
  parts.push({
    path: 'ppt/presentation.xml',
    xml: presentationXml(slideRids, deck.cx, deck.cy),
    type: PPTX_TYPES.presentation,
  });
  withRels(parts, 'ppt/presentation.xml', [
    { id: 'rId1', type: REL.slideMaster, target: 'slideMasters/slideMaster1.xml' },
    { id: 'rId2', type: REL.notesMaster, target: 'notesMasters/notesMaster1.xml' },
    ...deck.slides.map((_, i) => ({
      id: slideRids[i]!,
      type: REL.slide,
      target: `slides/slide${i + 1}.xml`,
    })),
    { id: `rId${after}`, type: REL.presProps, target: 'presProps.xml' },
    { id: `rId${after + 1}`, type: REL.viewProps, target: 'viewProps.xml' },
    { id: `rId${after + 2}`, type: REL.theme, target: 'theme/theme1.xml' },
    { id: `rId${after + 3}`, type: REL.tableStyles, target: 'tableStyles.xml' },
  ]);
  parts.push(
    { path: 'ppt/presProps.xml', xml: PRES_PROPS_XML, type: PPTX_TYPES.presProps },
    { path: 'ppt/viewProps.xml', xml: VIEW_PROPS_XML, type: PPTX_TYPES.viewProps },
    { path: 'ppt/tableStyles.xml', xml: TABLE_STYLES_XML, type: PPTX_TYPES.tableStyles },
    { path: 'ppt/theme/theme1.xml', xml: THEME_XML, type: THEME_TYPE },
    { path: 'ppt/theme/theme2.xml', xml: THEME_XML, type: THEME_TYPE },
    { path: MASTER, xml: slideMasterXml(), type: PPTX_TYPES.slideMaster },
    { path: LAYOUT, xml: slideLayoutXml(), type: PPTX_TYPES.slideLayout },
    { path: NOTES_MASTER, xml: notesMasterXml(), type: PPTX_TYPES.notesMaster },
  );
  withRels(parts, MASTER, [
    { id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rId2', type: REL.theme, target: '../theme/theme1.xml' },
  ]);
  withRels(parts, LAYOUT, [
    { id: 'rId1', type: REL.slideMaster, target: '../slideMasters/slideMaster1.xml' },
  ]);
  withRels(parts, NOTES_MASTER, [{ id: 'rId1', type: REL.theme, target: '../theme/theme2.xml' }]);

  let media = 0;
  deck.slides.forEach((slide, i) => {
    const n = i + 1;
    const path = `ppt/slides/slide${n}.xml`;
    const rels: OoxmlRel[] = [
      { id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' },
    ];
    const image = (png: Uint8Array): string => {
      media += 1;
      const name = `image${media}.png`;
      parts.push({ path: `ppt/media/${name}`, bytes: png });
      const id = `rId${rels.length + 1}`;
      rels.push({ id, type: REL.image, target: `../media/${name}` });
      return id;
    };
    const bgRid = slide.background?.kind === 'picture' ? image(slide.background.png) : undefined;
    const pictureRids = new Map<number, string>();
    slide.items.forEach((item, at) => {
      if (item.kind === 'picture') pictureRids.set(at, image(item.png));
    });
    if (slide.notes) {
      const notesPath = `ppt/notesSlides/notesSlide${n}.xml`;
      rels.push({
        id: `rId${rels.length + 1}`,
        type: REL.notesSlide,
        target: `../notesSlides/notesSlide${n}.xml`,
      });
      parts.push({ path: notesPath, xml: notesSlideXml(slide.notes), type: PPTX_TYPES.notesSlide });
      withRels(parts, notesPath, [
        { id: 'rId1', type: REL.notesMaster, target: '../notesMasters/notesMaster1.xml' },
        { id: 'rId2', type: REL.slide, target: `../slides/slide${n}.xml` },
      ]);
    }
    parts.push({
      path,
      xml: slideXml(slide, (at) => pictureRids.get(at)!, bgRid),
      type: PPTX_TYPES.slide,
    });
    withRels(parts, path, rels);
  });

  return writeOoxmlPackage(parts, when);
}
