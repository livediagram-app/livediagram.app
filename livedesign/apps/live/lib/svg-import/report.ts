// SVG import's report (docs/specs/020-import-export/svg-import.md "The import report"): what the shapes could not
// carry, counted per kind, and the sentence each kind reads as.

export const SVG_REPORT_KINDS = [
  'text',
  'gradient',
  'mask',
  'filter',
  'clipPath',
  'image',
  'pattern',
] as const;
export type SvgReportKind = (typeof SVG_REPORT_KINDS)[number];
export type SvgImportReport = Record<SvgReportKind, number>;

export function emptySvgReport(): SvgImportReport {
  return { text: 0, gradient: 0, mask: 0, filter: 0, clipPath: 0, image: 0, pattern: 0 };
}

const TITLES: Record<SvgReportKind, string> = {
  text: 'Text',
  gradient: 'Gradients',
  mask: 'Masks',
  filter: 'Filters',
  clipPath: 'Clip paths',
  image: 'Pictures',
  pattern: 'Patterns',
};

// One sentence per kind, singular and plural.
function sentence(kind: SvgReportKind, n: number): string {
  const one = n === 1;
  switch (kind) {
    case 'text':
      return `${n} text ${one ? 'element was' : 'elements were'} left out. Outline the text before exporting, or retype it.`;
    case 'gradient':
      return `${n} gradient ${one ? 'fill uses its' : 'fills use their'} first colour.`;
    case 'mask':
      return `${n} ${one ? 'mask was' : 'masks were'} ignored, so what ${one ? 'it' : 'they'} hid is shown.`;
    case 'filter':
      return `${n} ${one ? 'filter' : 'filters'} (shadows, blurs) ${one ? 'was' : 'were'} left out.`;
    case 'clipPath':
      return `${n} clip ${one ? 'path was' : 'paths were'} ignored, so what ${one ? 'it' : 'they'} cut is shown in full.`;
    case 'image':
      return `${n} embedded ${one ? 'picture was' : 'pictures were'} left out.`;
    case 'pattern':
      return `${n} pattern ${one ? 'fill was' : 'fills were'} left out.`;
  }
}

/** The report's lines, one per kind met, in the spec's order: what the Import dialog's report lists. */
export function svgReportLines(report: SvgImportReport): { title: string; message: string }[] {
  return SVG_REPORT_KINDS.filter((k) => report[k] > 0).map((k) => ({
    title: TITLES[k],
    message: sentence(k, report[k]),
  }));
}

/** The one toast drop and paste show: how many shapes came in, then every line's sentence. */
export function svgReportToast(paths: number, report: SvgImportReport): string {
  const head = `Brought in ${paths} ${paths === 1 ? 'shape' : 'shapes'}.`;
  return [head, ...svgReportLines(report).map((l) => l.message)].join(' ');
}
