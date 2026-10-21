import type { PreviewApp } from './apps.ts';
import { PreviewError } from './errors.ts';

// Every name a preview owns derives from its PR number, here and nowhere else
// (docs/specs/016-platform/pr-previews.md "Naming").
export const PREVIEW_ENV = 'preview';
export const PREVIEW_CONFIG_FILE = 'wrangler.preview.toml';
export const FULL_PREVIEW_LABEL = 'full-preview';
export const PREVIEW_ZONE = 'livediagram.app';
// Keeps the longest worker name (livediagram-telemetry-pr-999999) far below wrangler's 63.
export const MAX_PR_NUMBER = 999_999;

export type PrNumber = number & { readonly __pr: true };

export function parsePrNumber(value: unknown): PrNumber {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_PR_NUMBER) {
    throw new PreviewError('bad-pr', `not a PR number: ${JSON.stringify(value)}`);
  }
  return n as PrNumber;
}

export const workerName = (app: PreviewApp, pr: PrNumber): string => `livediagram-${app}-pr-${pr}`;
export const stagingWorkerName = (app: string): string => `livediagram-${app}-staging`;
export const d1Name = (pr: PrNumber): string => `livediagram-pr-${pr}`;
export const r2Name = (pr: PrNumber): string => `livediagram-images-pr-${pr}`;
export const previewHost = (pr: PrNumber): string => `pr-${pr}.${PREVIEW_ZONE}`;
export const previewOrigin = (pr: PrNumber): string => `https://${previewHost(pr)}`;

const OWNED = [
  /^livediagram-(?:marketing|live|telemetry|help|community|api|router)-pr-(\d+)$/,
  /^livediagram-pr-(\d+)$/,
  /^livediagram-images-pr-(\d+)$/,
];

/** The PR a worker, D1 or R2 name belongs to; null for anything else, production and staging included. */
export function ownerOf(name: string): PrNumber | null {
  for (const shape of OWNED) {
    const match = shape.exec(name);
    if (!match) continue;
    try {
      return parsePrNumber(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}
