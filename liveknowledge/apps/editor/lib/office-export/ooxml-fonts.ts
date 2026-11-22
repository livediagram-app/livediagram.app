// The safe fallback each face is written with (docs/specs/020-import-export/office-export.md "Fonts are named, never
// embedded"). The editor's curated Google fonts are rarely installed, so an app that lacks one is told what kind of
// face it is and which common face stands in, rather than guessing from the name alone.
import { XML_DECL, xmlText } from './ooxml';

export type OfficeFamily = 'swiss' | 'roman' | 'modern' | 'script' | 'decorative';
export type OfficeFace = {
  family: OfficeFamily;
  fixed: boolean;
  /** A face every Windows and Mac Office install has. */
  alt: string;
};

// Faces on both Windows and Mac Office, so a stand-in is never itself missing.
const SANS: OfficeFace = { family: 'swiss', fixed: false, alt: 'Arial' };
const SERIF: OfficeFace = { family: 'roman', fixed: false, alt: 'Georgia' };

const KNOWN: Readonly<Record<string, OfficeFace>> = {
  inter: SANS,
  poppins: SANS,
  nunito: SANS,
  'space grotesk': SANS,
  oswald: { family: 'swiss', fixed: false, alt: 'Arial Narrow' },
  lora: SERIF,
  'roboto slab': SERIF,
  'bodoni moda': { family: 'roman', fixed: false, alt: 'Times New Roman' },
  'roboto mono': { family: 'modern', fixed: true, alt: 'Courier New' },
  kalam: { family: 'script', fixed: false, alt: 'Comic Sans MS' },
  'shantell sans': { family: 'script', fixed: false, alt: 'Comic Sans MS' },
};

/** A face's fallback: the table's, else a guess from its name (mono, serif) and otherwise a sans. */
export function officeFace(name: string): OfficeFace {
  const known = KNOWN[name.trim().toLowerCase()];
  if (known) return known;
  if (/\b(mono|code|courier|consolas)\b/i.test(name))
    return { family: 'modern', fixed: true, alt: 'Courier New' };
  if (/\b(serif|georgia|times|garamond|palatino)\b/i.test(name) && !/sans/i.test(name))
    return SERIF;
  return SANS;
}

/** DrawingML `pitchFamily`: the pitch in the low two bits, the family in the high nibble (swiss 0x20, roman 0x10). */
export function pitchFamilyOf(name: string): number {
  const f = officeFace(name);
  const family = { roman: 0x10, swiss: 0x20, modern: 0x30, script: 0x40, decorative: 0x50 }[
    f.family
  ];
  return family + (f.fixed ? 1 : 2);
}

/** `word/fontTable.xml`: each face once, with its family, pitch and `altName`. */
export function fontTableXml(faces: readonly string[]): string {
  const seen = [...new Set(faces)];
  const entries = seen.map((name) => {
    const f = officeFace(name);
    return (
      `<w:font w:name="${xmlText(name)}"><w:altName w:val="${xmlText(f.alt)}"/>` +
      `<w:charset w:val="00"/><w:family w:val="${f.family}"/><w:pitch w:val="${f.fixed ? 'fixed' : 'variable'}"/></w:font>`
    );
  });
  return (
    `${XML_DECL}<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    entries.join('') +
    '</w:fonts>'
  );
}
