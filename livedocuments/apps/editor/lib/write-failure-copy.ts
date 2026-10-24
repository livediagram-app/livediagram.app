// What a failed document write says (docs/specs/013-workspace/folders.md "A write that fails says so"): one wording
// per verb, so the same failure reads the same wherever it happened. Each names what it failed on when the caller
// knows it (toast-name.ts).
import { toastName } from './toast-name';

type FailureCopy = (name?: string | null) => string;

const failure =
  (verb: string, fallback: string): FailureCopy =>
  (name) =>
    `Could not ${verb} ${toastName(name) ?? fallback}. Try again.`;

export const DOCUMENT_FAILURE = {
  rename: failure('rename', 'the document'),
  move: failure('move', 'the document'),
  delete: failure('delete', 'the document'),
  duplicate: failure('duplicate', 'the document'),
} as const satisfies Record<string, FailureCopy>;
