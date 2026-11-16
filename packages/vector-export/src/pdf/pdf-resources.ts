// The one resource dictionary every page, form and pattern of a PDF shares (liveworkspace/docs/specs/013-export/vector-pdf.md "The file"):
// graphics states, pictures, forms, patterns and fonts, each given a short name once and written at the end.
import type { PdfFile } from './pdf-file';

type Kind = 'ExtGState' | 'XObject' | 'Pattern' | 'Font';
const PREFIX: Record<Kind, string> = { ExtGState: 'G', XObject: 'X', Pattern: 'P', Font: 'F' };

export class PdfResources {
  readonly ref: number;
  private readonly entries: Record<Kind, Map<string, string>> = {
    ExtGState: new Map(),
    XObject: new Map(),
    Pattern: new Map(),
    Font: new Map(),
  };
  // Graphics states by their settings, so a hundred half-transparent shapes share one.
  private readonly states = new Map<string, string>();

  readonly file: PdfFile;

  constructor(file: PdfFile) {
    this.file = file;
    this.ref = file.alloc();
  }

  /** The name of object `obj` among the resources of its kind. */
  name(kind: Kind, obj: number): string {
    const name = `${PREFIX[kind]}${this.entries[kind].size}`;
    this.entries[kind].set(name, `${obj} 0 R`);
    return name;
  }

  /** A graphics state's name: fill and stroke alpha, and a blend mode. */
  state(fillAlpha: number, strokeAlpha: number, blend = 'Normal'): string {
    const ca = Math.round(fillAlpha * 1000) / 1000;
    const CA = Math.round(strokeAlpha * 1000) / 1000;
    const key = `${ca}|${CA}|${blend}`;
    const hit = this.states.get(key);
    if (hit) return hit;
    const obj = this.file.put(
      this.file.alloc(),
      `<< /Type /ExtGState /ca ${ca} /CA ${CA} /BM /${blend} >>`,
    );
    const name = this.name('ExtGState', obj);
    this.states.set(key, name);
    return name;
  }

  /** Writes the dictionary, once every name is given. */
  write(): void {
    const dict = (Object.keys(this.entries) as Kind[])
      .filter((k) => this.entries[k].size > 0)
      .map((k) => `/${k} << ${[...this.entries[k]].map(([n, r]) => `/${n} ${r}`).join(' ')} >>`)
      .join(' ');
    this.file.put(this.ref, `<< /ProcSet [/PDF /Text /ImageB /ImageC] ${dict} >>`);
  }
}
