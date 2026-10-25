import { LicencesError } from '../src/errors.ts';

// `[licences] <fingerprint> key=value ...` (blueprint "Observability").
export function log(fingerprint: string, fields: Record<string, string | number>): void {
  const pairs = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
  console.log(['[licences]', fingerprint, ...pairs].join(' '));
}

export function logFailure(error: unknown): void {
  const code = error instanceof LicencesError ? error.code : 'Unexpected';
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[licences] licences.error code=${code} message=${JSON.stringify(message)}`);
  if (!(error instanceof LicencesError) && error instanceof Error) console.error(error.stack);
}
