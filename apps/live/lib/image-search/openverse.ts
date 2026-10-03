// The Openverse side of Image search (docs/specs/009-elements/image-search.md):
// the request URL, a defensive parse of the answer, and the credit a picked
// picture leaves on its element. Pure, so it runs under Node in tests.

import { IMAGE_CREDIT_TEXT_MAX, isCreditUrl, type ImageCredit } from '@livediagram/document';

export const OPENVERSE_API_BASE = 'https://api.openverse.org/v1';
// Openverse's anonymous maximum.
export const OPENVERSE_PAGE_SIZE = 20;
// Only pictures that may be used commercially AND modified (CC0, PDM, BY,
// BY-SA): a diagram may be used at work, and the canvas crops and resizes.
export const OPENVERSE_LICENSE_TYPE = 'commercial,modification';

export type OpenverseImage = {
  id: string;
  // The full-size picture at its host.
  url: string;
  // Openverse's own raster thumbnail of it (always cross-origin readable).
  thumbnail: string;
  width: number | null;
  height: number | null;
  title?: string;
  creator?: string;
  license?: string;
  licenseVersion?: string;
  licenseUrl?: string;
  landingUrl?: string;
};

export type OpenverseSearchPage = {
  results: OpenverseImage[];
  page: number;
  pageCount: number;
};

export type OpenverseSearchErrorKind = 'rate-limited' | 'failed';

export class OpenverseSearchError extends Error {
  readonly kind: OpenverseSearchErrorKind;
  readonly status?: number;
  constructor(kind: OpenverseSearchErrorKind, status?: number) {
    super(`openverse search ${kind}`);
    this.name = 'OpenverseSearchError';
    this.kind = kind;
    this.status = status;
  }
}

export function openverseSearchUrl(query: string, page: number): string {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(OPENVERSE_PAGE_SIZE),
    license_type: OPENVERSE_LICENSE_TYPE,
    mature: 'false',
  });
  return `${OPENVERSE_API_BASE}/images/?${params.toString()}`;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const optStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const httpsUrl = (v: unknown): string | null =>
  typeof v === 'string' && v.startsWith('https://') ? v : null;
const positive = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

function parseResult(raw: unknown): OpenverseImage | null {
  if (!isObj(raw)) return null;
  const id = optStr(raw.id);
  const url = httpsUrl(raw.url);
  const thumbnail = httpsUrl(raw.thumbnail);
  if (!id || !url || !thumbnail) return null;
  return {
    id,
    url,
    thumbnail,
    width: positive(raw.width),
    height: positive(raw.height),
    title: optStr(raw.title),
    creator: optStr(raw.creator),
    license: optStr(raw.license),
    licenseVersion: optStr(raw.license_version),
    licenseUrl: optStr(raw.license_url),
    landingUrl: optStr(raw.foreign_landing_url),
  };
}

// Answers are untrusted: only the fields above survive, and a broken result
// is dropped rather than failing the page.
export function parseOpenverseSearch(json: unknown, page: number): OpenverseSearchPage {
  if (!isObj(json) || !Array.isArray(json.results)) throw new OpenverseSearchError('failed');
  const results = json.results.map(parseResult).filter((r): r is OpenverseImage => r !== null);
  const pageCount = positive(json.page_count) ?? 0;
  return { results, page, pageCount: Math.floor(pageCount) };
}

// `cc0` → `CC0 1.0`, `pdm` → `Public Domain Mark 1.0`, `by-sa` + `4.0` → `CC BY-SA 4.0`.
export function licenceLabel(code?: string, version?: string): string | undefined {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  if (lower === 'pdm') return `Public Domain Mark ${version ?? '1.0'}`;
  if (lower === 'cc0') return `CC0 ${version ?? '1.0'}`;
  return `CC ${lower.toUpperCase()}${version ? ` ${version}` : ''}`;
}

// The credit a pick leaves on its element; none when there is no source page
// to link to.
export function creditFor(result: OpenverseImage): ImageCredit | undefined {
  if (!result.landingUrl || !isCreditUrl(result.landingUrl)) return undefined;
  const parts = [
    result.title ? `"${result.title}"` : '',
    result.creator ? `${result.title ? ' by' : 'By'} ${result.creator}` : '',
  ].join('');
  const licence = licenceLabel(result.license, result.licenseVersion);
  const text = [parts, licence].filter(Boolean).join(', ').trim() || 'Openverse image';
  const credit: ImageCredit = {
    text: text.slice(0, IMAGE_CREDIT_TEXT_MAX),
    sourceUrl: result.landingUrl,
  };
  if (result.licenseUrl && isCreditUrl(result.licenseUrl)) credit.licenseUrl = result.licenseUrl;
  return credit;
}

// The gallery name a pick is stored under.
export function galleryNameFor(result: OpenverseImage): string {
  return result.title ?? `openverse-${result.id}`;
}

// The tile's accessible name: "Use <title> by <creator>", parts omitted when unknown.
export function tileLabelFor(result: OpenverseImage): string {
  const what = result.title ?? 'image';
  return result.creator ? `Use ${what} by ${result.creator}` : `Use ${what}`;
}
