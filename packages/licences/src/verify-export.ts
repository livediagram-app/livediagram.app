import type { LicencesManifest } from './contract.ts';

// The exported licences.html may not exceed this (blueprint D14): three times
// the page as first measured, so dependencies can grow but inlined licence
// texts cannot sneak in.
export const LICENCES_HTML_BUDGET_BYTES = 300_000;

type Export = {
  manifest: LicencesManifest;
  // undefined when the page was not exported.
  htmlBytes: number | undefined;
  exportedTexts: string[];
};

// What is wrong with an exported /licences page; empty when nothing is.
export function checkExport({ manifest, htmlBytes, exportedTexts }: Export): string[] {
  const problems: string[] = [];
  const hashes = Object.keys(manifest.texts);
  if (hashes.length === 0) problems.push('the manifest lists no texts');
  if (htmlBytes === undefined) problems.push('licences.html was not exported');
  else if (htmlBytes > LICENCES_HTML_BUDGET_BYTES) {
    problems.push(`licences.html is ${htmlBytes} bytes, over ${LICENCES_HTML_BUDGET_BYTES}`);
  }
  const exported = new Set(exportedTexts);
  for (const hash of hashes) {
    if (!exported.has(`${hash}.txt`)) problems.push(`text ${hash}.txt was not exported`);
  }
  return problems;
}
