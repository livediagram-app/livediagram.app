// Every way the preview tooling refuses to guess
// (docs/specs/016-platform/blueprints/pr-previews.md "Interfaces and contracts").
export type PreviewErrorCode =
  | 'bad-pr'
  | 'no-staging-env'
  | 'bad-name'
  | 'unknown-key'
  | 'bad-service'
  | 'kv-in-preview'
  | 'bad-d1'
  | 'bad-r2'
  | 'missing-var'
  | 'has-routes'
  | 'not-in-tier'
  | 'bad-turbo';

export class PreviewError extends Error {
  readonly code: PreviewErrorCode;

  constructor(code: PreviewErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'PreviewError';
    this.code = code;
  }
}
