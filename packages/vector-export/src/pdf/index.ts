// The PDF writer's door (liveworkspace/docs/specs/013-export/vector-pdf.md): loaded only when a PDF is exported, by a dynamic import.
export {
  DEFAULT_RASTER_SCALE,
  svgPagesToPdf,
  type SvgPdfOptions,
  type SvgPdfPage,
} from './svg-to-pdf';
export { MAX_PDF_PAGE_PT, PT_PER_PX, pageMedia, singlePageMedia } from './pdf-page-size';
export { linkAnnotation, pdfString, type PdfLink } from './pdf-links';
