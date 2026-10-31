// The one DrawingML theme a written deck carries (docs/specs/020-import-export/blueprints/office-export.md "The
// fixed parts"): Office's own colours and Calibri, the three fill, line, effect and background styles the schema asks
// for, and nothing that styles content, since every shape the export writes names its own colours and faces. Pure
// data.

import { XML_DECL } from './ooxml';

const SYS = (name: string, last: string) => `<a:sysClr val="${name}" lastClr="${last}"/>`;
const RGB = (hex: string) => `<a:srgbClr val="${hex}"/>`;
const PH = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';

export const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';

export const THEME_XML =
  `${XML_DECL}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="livedocuments">` +
  '<a:themeElements>' +
  '<a:clrScheme name="livedocuments">' +
  `<a:dk1>${SYS('windowText', '000000')}</a:dk1><a:lt1>${SYS('window', 'FFFFFF')}</a:lt1>` +
  `<a:dk2>${RGB('1E293B')}</a:dk2><a:lt2>${RGB('F1F5F9')}</a:lt2>` +
  `<a:accent1>${RGB('D97706')}</a:accent1><a:accent2>${RGB('2563EB')}</a:accent2>` +
  `<a:accent3>${RGB('16A34A')}</a:accent3><a:accent4>${RGB('DC2626')}</a:accent4>` +
  `<a:accent5>${RGB('7C3AED')}</a:accent5><a:accent6>${RGB('0891B2')}</a:accent6>` +
  `<a:hlink>${RGB('2563EB')}</a:hlink><a:folHlink>${RGB('7C3AED')}</a:folHlink>` +
  '</a:clrScheme>' +
  '<a:fontScheme name="livedocuments">' +
  '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
  '</a:fontScheme>' +
  '<a:fmtScheme name="livedocuments">' +
  `<a:fillStyleLst>${PH}${PH}${PH}</a:fillStyleLst>` +
  '<a:lnStyleLst>' +
  [6350, 12700, 19050]
    .map(
      (w) =>
        `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr">${PH}<a:prstDash val="solid"/></a:ln>`,
    )
    .join('') +
  '</a:lnStyleLst>' +
  '<a:effectStyleLst>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) +
  '</a:effectStyleLst>' +
  `<a:bgFillStyleLst>${PH}${PH}${PH}</a:bgFillStyleLst>` +
  '</a:fmtScheme>' +
  '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
