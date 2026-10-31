// Every number Word and PowerPoint import uses (docs/specs/020-import-export/office-import.md "Untrusted files";
// the blueprint's "Constants and configuration" gives each one's provenance and safe range).

const MB = 1024 * 1024;

/** The largest file an import reads (the image pipeline's own source cap). */
export const OFFICE_MAX_FILE_BYTES = 50 * MB;
/** The most entries a package may list. */
export const OFFICE_MAX_ZIP_ENTRIES = 4000;
/** The most one XML part may unpack to. */
export const OFFICE_MAX_PART_BYTES = 32 * MB;
/** The most everything one import unpacks may add up to. */
export const OFFICE_MAX_UNPACKED_BYTES = 256 * MB;
/** Compressed input handed to the inflater per write, so one write unpacks at most ~16.5 MB (D60). */
export const OFFICE_INFLATE_SLICE_BYTES = 16 * 1024;
/** How deep an XML part may nest. */
export const OFFICE_XML_MAX_DEPTH = 256;
/** The most elements one XML part may hold. */
export const OFFICE_XML_MAX_ELEMENTS = 1_000_000;
/** The most pictures one import stores (the hosted gallery's count). */
export const OFFICE_MAX_IMAGES = 100;
/** The most items one slide brings across. */
export const OFFICE_MAX_SLIDE_ITEMS = 300;
/** The longest a slide's imported notes may be, in characters (D61). */
export const OFFICE_NOTES_MAX = 20_000;

/** OOXML's units: 914,400 EMU an inch, 96 px an inch, 72 pt an inch. */
export const EMU_PER_PX = 9525;
export const EMU_PER_PT = 12700;
