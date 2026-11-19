// The named constants of the Visio importer (docs/specs/020-import-export/visio-import.md "Inputs",
// blueprints/visio-import.md "Constants and configuration"). The file is untrusted: every size it can
// grow is capped here.

const MiB = 1024 * 1024;

/** Largest file the importer reads (spec: 50 MB, as draw.io's). */
export const VISIO_MAX_FILE_BYTES = 50 * MiB;
/** Inflate allowance across one whole import, a zip-bomb guard (spec: 100 MB). */
export const VISIO_MAX_INFLATED_BYTES = 100 * MiB;
/** Largest single XML part, checked on its declared size before it is read or parsed. */
export const VISIO_MAX_PART_BYTES = 20 * MiB;
/** Zip entries a package may list; a real drawing has tens, a big one a few hundred. */
export const VISIO_MAX_ZIP_ENTRIES = 10_000;
/** XML elements one part may hold once parsed (a 10 000-shape page is about 250 000). */
export const VISIO_MAX_XML_ELEMENTS = 400_000;
/** Masters read from one file; the rest map as unknown masters. */
export const VISIO_MAX_MASTERS = 2000;
/** How deep groups nest before their shapes are left out. */
export const VISIO_MAX_GROUP_DEPTH = 32;
/** Largest embedded picture brought in; a larger one is a placeholder. */
export const VISIO_MAX_IMAGE_BYTES = 10 * MiB;
/** Characters of one shape's text; the rest is cut and counted. */
export const VISIO_MAX_TEXT = 5000;
/** Pixels per Visio inch: the CSS inch (V1). */
export const VISIO_PX_PER_INCH = 96;
/** Points per inch, for font sizes. */
export const VISIO_PT_PER_INCH = 72;
/** A page's height when its sheet sets none: US Letter portrait. */
export const VISIO_DEFAULT_PAGE_HEIGHT_IN = 11;

/** What the Import dialog's Visio picker offers. */
export const VISIO_TAB_FILE_ACCEPT =
  '.vsdx,.vsdm,application/vnd.ms-visio.drawing,application/vnd.ms-visio.drawing.macroEnabled.12';
