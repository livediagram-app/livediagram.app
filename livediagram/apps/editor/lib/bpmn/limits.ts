// The BPMN import's caps (docs/specs/020-import-export/bpmn-import.md "Reading the file").

const MiB = 1024 * 1024;

/** The largest file read: past it, refused unread. Real process models are tens of KB. */
export const BPMN_MAX_FILE_BYTES = 5 * MiB;
/** The most XML elements the walk reads before refusing the file as too complex. */
export const BPMN_MAX_XML_ELEMENTS = 100_000;
/** The most elements drawn; the rest are counted in the report. */
export const BPMN_MAX_DRAWN = 2_000;
/** The Import to Tab file picker's filter. */
export const BPMN_FILE_ACCEPT = '.bpmn,.xml,application/xml,text/xml';
/** The gutter a horizontal pool's or lane's upright title takes, as modelers draw it. */
export const BPMN_LANE_GUTTER_PX = 30;
/** A name drawn under a symbol, when the file gives no label bounds: its box. */
export const BPMN_NAME_WIDTH_PX = 120;
export const BPMN_NAME_HEIGHT_PX = 20;
/** The widest a name grows to hold itself on one line before it wraps. */
export const BPMN_NAME_MAX_WIDTH_PX = 160;
/** At most this many unmatched element types are named in the report. */
export const BPMN_REPORT_NAMES_MAX = 5;
