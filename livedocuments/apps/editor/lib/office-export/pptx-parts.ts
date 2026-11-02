// The parts every written deck has besides its slides (docs/specs/020-import-export/blueprints/office-export.md "The
// fixed parts"): the presentation, one slide master and its one Blank layout, the notes master, and the
// presentation, view and table-style properties PowerPoint expects to find. Pure string building.

import { XML_DECL } from './ooxml';
import { PML_NS, SP_TREE_HEAD } from './pptx-slide-xml';

const PML = 'application/vnd.openxmlformats-officedocument.presentationml';
export const PPTX_TYPES = {
  presentation: `${PML}.presentation.main+xml`,
  slide: `${PML}.slide+xml`,
  slideMaster: `${PML}.slideMaster+xml`,
  slideLayout: `${PML}.slideLayout+xml`,
  notesMaster: `${PML}.notesMaster+xml`,
  notesSlide: `${PML}.notesSlide+xml`,
  presProps: `${PML}.presProps+xml`,
  viewProps: `${PML}.viewProps+xml`,
  tableStyles: `${PML}.tableStyles+xml`,
} as const;

// A portrait notes page, 7.5 x 10 in: PowerPoint's own.
const NOTES_CX = 6_858_000;
const NOTES_CY = 9_144_000;

// The first slide id PowerPoint accepts; master and layout ids live above 2^31.
export const FIRST_SLIDE_ID = 256;
const MASTER_ID = 2_147_483_648;

const CLR_MAP =
  'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3"' +
  ' accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

const BG_REF = '<p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>';

/** A default text level: its size, in hundredths of a point, on the theme's minor face. */
const level = (sz: number) =>
  `<a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">` +
  `<a:defRPr sz="${sz}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>` +
  '<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>';

/** `ppt/presentation.xml`: the master, the notes master, the slides by relationship, and the slide size. */
export function presentationXml(slideRids: readonly string[], cx: number, cy: number): string {
  const slides = slideRids
    .map((rId, i) => `<p:sldId id="${FIRST_SLIDE_ID + i}" r:id="${rId}"/>`)
    .join('');
  return (
    `${XML_DECL}<p:presentation ${PML_NS} saveSubsetFonts="1">` +
    `<p:sldMasterIdLst><p:sldMasterId id="${MASTER_ID}" r:id="rId1"/></p:sldMasterIdLst>` +
    '<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>' +
    `<p:sldIdLst>${slides}</p:sldIdLst>` +
    `<p:sldSz cx="${Math.round(cx)}" cy="${Math.round(cy)}"/><p:notesSz cx="${NOTES_CX}" cy="${NOTES_CY}"/>` +
    `<p:defaultTextStyle>${level(1800)}</p:defaultTextStyle></p:presentation>`
  );
}

/** The slide master: a white background, no placeholders of its own, and the default text styles. */
export function slideMasterXml(): string {
  return (
    `${XML_DECL}<p:sldMaster ${PML_NS}><p:cSld>${BG_REF}<p:spTree>${SP_TREE_HEAD}</p:spTree></p:cSld>` +
    `<p:clrMap ${CLR_MAP}/>` +
    `<p:sldLayoutIdLst><p:sldLayoutId id="${MASTER_ID + 1}" r:id="rId1"/></p:sldLayoutIdLst>` +
    `<p:txStyles><p:titleStyle>${level(4400)}</p:titleStyle><p:bodyStyle>${level(2800)}</p:bodyStyle>` +
    `<p:otherStyle>${level(1800)}</p:otherStyle></p:txStyles></p:sldMaster>`
  );
}

/** The one layout every slide uses: Blank. */
export function slideLayoutXml(): string {
  return (
    `${XML_DECL}<p:sldLayout ${PML_NS} type="blank" preserve="1"><p:cSld name="Blank">` +
    `<p:spTree>${SP_TREE_HEAD}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  );
}

/** The notes master: the slide image over the notes body, where each notes slide's placeholders inherit their
 *  places from. */
export function notesMasterXml(): string {
  const ph = (
    id: number,
    name: string,
    type: string,
    x: number,
    y: number,
    cx: number,
    cy: number,
  ) =>
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="${type}"${type === 'body' ? ' idx="1"' : ''}/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    (type === 'body'
      ? '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>'
      : '') +
    '</p:sp>';
  return (
    `${XML_DECL}<p:notesMaster ${PML_NS}><p:cSld>${BG_REF}<p:spTree>${SP_TREE_HEAD}` +
    ph(2, 'Slide Image Placeholder 1', 'sldImg', 381_000, 685_800, 6_096_000, 3_429_000) +
    ph(3, 'Notes Placeholder 2', 'body', 685_800, 4_400_550, 5_486_400, 3_600_450) +
    `</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/><p:notesStyle>${level(1200)}</p:notesStyle></p:notesMaster>`
  );
}

export const PRES_PROPS_XML = `${XML_DECL}<p:presentationPr ${PML_NS}/>`;

export const VIEW_PROPS_XML =
  `${XML_DECL}<p:viewPr ${PML_NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>` +
  '<p:gridSpacing cx="76200" cy="76200"/></p:viewPr>';

export const TABLE_STYLES_XML =
  `${XML_DECL}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
  ' def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>';
