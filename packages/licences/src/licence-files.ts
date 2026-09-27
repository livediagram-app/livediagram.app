import { createHash } from 'node:crypto';

// A file at a work's root that carries its licence or notices: LICENSE,
// LICENCE, COPYING, NOTICE, COPYRIGHT or ThirdPartyNotices, any case, with any
// extension or suffix (LICENSE-MIT, NOTICE.txt).
const LICENCE_FILE_PATTERN =
  /^(licen[cs]e|copying|notice|copyright|third[-_ ]?party[-_ ]?notices)([-_.].*)?$/i;

export const isLicenceFile = (name: string): boolean => LICENCE_FILE_PATTERN.test(name);

// Texts are compared, hashed and served in one form: no BOM, LF line ends, no
// trailing whitespace at the end, one final newline. Empty when blank.
export function normaliseText(raw: string): string {
  const text = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trimEnd();
  return text ? `${text}\n` : '';
}

// A text's file name on the page (blueprint D3): 64 bits of its sha256.
export const TEXT_HASH_LENGTH = 16;

export const textHash = (normalised: string): string =>
  createHash('sha256').update(normalised).digest('hex').slice(0, TEXT_HASH_LENGTH);
